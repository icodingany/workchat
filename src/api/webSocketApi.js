import base64 from '@/utils/base64.js'
import store from '../store'
import { normalizeWxId } from '@/utils/wechat'
import { ElMessage as Message } from 'element-plus'

import { sendSock, retryWebSocketConnection } from '@/websocket/websocket'
import { generateTaskId } from '@/utils/common'
import { getTaskIdLookupKeys } from '@/utils/taskIdLookupKeys'
import { buildForwardMultiPayload } from '@/utils/forwardHelpers'
import { claimWsSessionOwner, getWsSessionOwnerId, isCurrentWsSessionOwner } from '@/utils/wsSessionOwner'
import { getWebSocketDeviceType } from '@/utils/deviceDetector'
import { prepareShiPinHaoMaterialContent } from '@/utils/shiPinHaoPayload'

/** TalkToFriend 本地超时（手机静默丢任务时兜底标红点，对齐 kelailaichatpc） */
const TALK_TO_FRIEND_TIMEOUT_MS = 20000

/** taskId → setTimeout id；回执到达时 clear */
const talkToFriendTaskTimeouts = new Map()

/** PostSns 本地超时：手机 hook 偶发执行中断且不回执（2026-08-28 发圈事故），PC 兜底提示 */
const POST_SNS_TIMEOUT_MS = 60000

/** wxId → setTimeout id；PostSnsTaskResultNotice 到达时 clear */
const postSnsTaskTimeouts = new Map()

/**
 * 清除发圈超时计时器（回执到达时调用）。
 * @param {string|object} wxIdOrMsg WxId 或含 WxId 的回执对象（定时发圈 TaskId 会被调度器二次生成，只能按 WxId 匹配）
 * @returns {boolean}
 */
export function clearPostSnsTaskTimeout(wxIdOrMsg) {
  const wxId = wxIdOrMsg && typeof wxIdOrMsg === 'object' ? wxIdOrMsg.WxId || wxIdOrMsg.wxId : wxIdOrMsg
  const key = wxId != null ? String(wxId) : ''
  if (!key) return false
  const timer = postSnsTaskTimeouts.get(key)
  if (timer) {
    clearTimeout(timer)
    postSnsTaskTimeouts.delete(key)
    return true
  }
  return false
}

/** 最近一次发起 DeviceAuthReq 的时间（用于忽略旧连接误发的「别处登录」） */
let lastDeviceAuthAttemptTime = 0

/** @returns {number} */
export function getLastDeviceAuthAttemptTime() {
  return lastDeviceAuthAttemptTime
}

export function markDeviceAuthAttempt() {
  lastDeviceAuthAttemptTime = Date.now()
}

function getTalkToFriendTransportBlockReason() {
  const state = store && store.state ? store.state : {}
  if (state.webSocketState !== 1) return 'WebSocket 已断开，请重连后重试'
  if (!state.webSocketToken) return 'WebSocket 未认证，请重连后重试'
  return ''
}

let _lastWsReauthOnSendAt = 0
const WS_REAUTH_ON_SEND_COOLDOWN_MS = 30000

function resolveLoginInfoForWsReauth() {
  try {
    const name =
      sessionStorage.getItem('sessionNameOfJuboChat') ||
      localStorage.getItem('localNameOfJuboChat') ||
      ''
    const pass =
      sessionStorage.getItem('sessionPwdOfJuboChat') ||
      localStorage.getItem('localPwdOfJuboChat') ||
      ''
    if (name && pass) return { name, pass }
  } catch (_) {
    /* ignore */
  }
  return null
}

/** 发送受阻时自动重连/重认证（30s 冷却） */
export function requestWebSocketReauthOnSendBlocked() {
  const state = store && store.state ? store.state : {}
  const needReconnect = state.webSocketState !== 1
  const needReauth = !state.webSocketToken
  if (!needReconnect && !needReauth) return

  const now = Date.now()
  if (now - _lastWsReauthOnSendAt < WS_REAUTH_ON_SEND_COOLDOWN_MS) return
  _lastWsReauthOnSendAt = now

  if (!isCurrentWsSessionOwner()) return
  const httpToken = state.httpToken
  if (!httpToken || String(httpToken).trim() === '') return

  const loginInfo = resolveLoginInfoForWsReauth()
  if (!loginInfo || !loginInfo.name || !loginInfo.pass) return

  console.warn('[WS] 发送受阻，尝试自动重连/重认证', { needReconnect, needReauth })
  const wsUrl = process.env.VUE_APP_WEBSOCKET_URL
  if (needReconnect && wsUrl) {
    retryWebSocketConnection(wsUrl)
    return
  }
  deviceAuthReq(loginInfo.name, loginInfo.pass)
}

/**
 * 构建本地占位消息的 Content（图片钉死 Thumb 秒显缩略图）
 * @param {string} contentType
 * @param {string} content
 * @returns {string} base64 编码后的本地 Content
 */
function buildLocalPlaceholderContent(contentType, content) {
  const ct = String(contentType || '')
  const raw = typeof content === 'string' ? content : ''
  const isPicture = ct === 'Picture' || ct === '2'
  const isVideo = ct === 'Video' || ct === '4'
  if (isPicture && /^https?:\/\//i.test(raw.trim())) {
    const url = raw.trim()
    return base64.encode(JSON.stringify({ Thumb: url, url }))
  }
  if (isVideo && /^https?:\/\//i.test(raw.trim())) {
    const url = raw.trim()
    return base64.encode(JSON.stringify({ thumbUrl: url, url }))
  }
  return base64.encode(raw)
}

/**
 * 清除 TalkToFriend 发送超时计时器（成功/失败回执到达时调用）
 * @param {any} taskIdOrMsg TaskId 或含 TaskId 的对象
 * @returns {boolean}
 */
export function clearTalkToFriendTaskTimeout(taskIdOrMsg) {
  const ids = new Set()
  const add = (v) => {
    if (v == null || v === '' || String(v) === '0') return
    getTaskIdLookupKeys(v).forEach((k) => {
      if (k && k !== '0') ids.add(k)
    })
  }
  if (taskIdOrMsg && typeof taskIdOrMsg === 'object') {
    add(taskIdOrMsg.TaskId)
    add(taskIdOrMsg.taskId)
    add(taskIdOrMsg.MsgId)
    add(taskIdOrMsg.msgId)
  } else {
    add(taskIdOrMsg)
  }
  let cleared = false
  ids.forEach((id) => {
    const timer = talkToFriendTaskTimeouts.get(id)
    if (timer) {
      clearTimeout(timer)
      talkToFriendTaskTimeouts.delete(id)
      cleared = true
    }
  })
  return cleared
}

/**
 * 备(手机客户端、客服客户端)获取通信token请求
 * @param {String} userName 用户名
 * @param {String} password 密码
 * @returns DeviceAuthRsp
 */
export function deviceAuthReq(userName, password) {
  // 声明当前 Tab 为最新 WS 会话，旧 Tab 会被挤下线
  claimWsSessionOwner()
  markDeviceAuthAttempt()
  const sessionOwnerId = getWsSessionOwnerId()
  const deviceType = getWebSocketDeviceType()
  // credential 格式：username:password:deviceType[:sessionOwnerId]
  // 后端按首尾冒号解析，password 可含冒号
  const raw = sessionOwnerId
    ? `${userName}:${password}:${deviceType}:${sessionOwnerId}`
    : `${userName}:${password}:${deviceType}`
  const msg = {
    Id: 1010, // 非必须
    AccessToken: '', // 非必须
    MsgType: 'DeviceAuthReq',
    Content: {
      AuthType: 2,
      Credential: base64.encode(raw)
    }
  }
  return sendSock(msg)
}

/**
 * 向服务端发心跳
 * @param {String} token token
 */
export function heartBeatReq(token) {
  const msg = {
    Id: 1001,
    MsgType: 'HeartBeatReq',
    AccessToken: token,
    Content: {}
  }
  console.log('发送心跳', new Date().toLocaleString())
  sendSock(msg)
}

/**
 * 触发手机推送会话列表任务
 * @param {String} WxId 微信id
 * @returns ConversationPushNotice
 */
export function TriggerConversationPushTask(WxId) {
  const id = normalizeWxId(WxId)
  if (!id) return
  const msg = {
    Id: 1232,
    MsgType: 'TriggerConversationPushTask',
    // Flag=1：读企微已加载会话（GetConversationList）；Flag=0 走 FetchSessionList 异步，
    // 在企微 5.0.10(79131) 上常等不到 LoadConv_All，导致服务端/PC 会话列表一直为空。
    // WxId 用字符串避免 int64 精度丢失（Content 由 sendSock 统一序列化）
    Content: { WxId: id, Flag: 1 },
    AccessToken: store.state.webSocketToken || ''
  }
  sendSock(msg)
}

/**
 * 获取微信的二维码
 * @param {Number} wxid 微信id
 * @returns PullMyQrCodeTaskResultNotice
 */
export function PullMyQrCodeTask(wxid) {
  let msg = {
    Id: 1216,
    AccessToken: '',
    MsgType: 'PullMyQrCodeTask',
    Content: {
      WxId: wxid
    }
  }
  sendSock(msg)
}

/**
 * 触发手机推送微信好友列表任务
 * @param {String} wxid
 * @returns WxFriendPushNotice
 */
export function triggerWechatFriendPushTask(wxid) {
  let msg = {
    Id: 1204,
    AccessToken: '',
    MsgType: 'TriggerWechatFriendPushTask',
    Content: {
      WxId: wxid
    }
  }
  sendSock(msg)
}

/**
 * 添加客户-通过手机号搜索添加微信
 * @param {Number} wxid 微信号
 * @param {String} keyword 搜索关键字
 * @param {String} msg 招呼语, 缺省：我是xxx公司的xxx，添加我的企业微信与我联系吧。
 * @param {String} memo 备注
 * @param {String} labels 标签
 * @returns TaskResultNotice
 */
export function AddCustomerFromSearchTask(wxid, keyword, hiMsg, memo, labels, userId) {
  const content = {
    WxId: wxid,
    Key: keyword,
    Msg: hiMsg,
    Memo: memo,
    Labels: labels,
    TaskId: generateTaskId()
  }
  const msg = {
    Id: 1215,
    AccessToken: '',
    MsgType: 'AddCustomerFromSearchTask',
    Content: content
  }
  sendSock(msg)

  // 任务保存到nedb
  let doc = {}
  for (const key in content) {
    if (content.hasOwnProperty(key)) {
      doc[key] = content[key]
    }
  }
  doc.userId = userId
  doc.result = '指令已发出'
  store.dispatch('tools/UpdateAddCustomerFromSearchTask', doc)
}

/**
 * 添加客户-从微信好友中添加
 * @param {Number} wxid
 * @param {Number} count 添加的个数
 * @param {Number} startIndex 添加的起始位置
 * @param {String} hiMsg 招呼语，缺省：你好这是我的企业微信，以后也可以在这里与我联系。
 * @returns TaskResultNotice
 */
export function addCustomerFromWxTask(wxid, count, startIndex, hiMsg) {
  let content = {
    WxId: wxid,
    Count: count,
    Index: startIndex,
    Msg: hiMsg,
    TaskId: generateTaskId()
  }
  let msg = { Id: 1214, AccessToken: '', MsgType: 'AddCustomerFromWxTask', Content: content }
  sendSock(msg)
}

/**
 * 通过微信好友的wxid添加客户
 * @param {Number} wxid 微信id
 * @param {String} Ids 微信好友OpenId列表
 * @param {String} hiMsg 招呼语，缺省：你好这是我的企业微信，以后也可以在这里与我联系。
 */
export function addCustomerByIdTask(wxid, Ids, hiMsg) {
  let msg = {
    Id: 1215,
    AccessToken: '',
    MsgType: 'AddCustomerByIdTask',
    Content: {
      WxId: wxid,
      Ids: Ids,
      Msg: hiMsg,
      TaskId: generateTaskId()
    }
  }
  sendSock(msg)
}

/**
 * 通知手机推送聊天记录（已废弃）
 * 对齐 kelailaichatpc：打开会话改走 HTTP 历史 / triggerHistory；WS TriggerHistory 易洪水卡死主线程。
 */
export function triggerHistoryMsgPushTask(wxid, convId, refMsgId = 0, flag = 0, localId = 0) {
  console.warn('[TriggerHistoryMsgPushTask] 已废弃，请改用 HTTP triggerHistory / pageList', {
    WxId: wxid != null ? String(wxid) : '',
    ConvId: convId != null ? String(convId) : '',
    LocalId: localId != null ? String(localId) : '',
    RefMsgId: refMsgId,
    Flag: flag
  })
}

/**
 * 通过消息Id下载文件（图片，视频） 返回 DownloadFileResultNotice
 * MsgId / MsgRemoteId 必须用字符串传输，避免 int64 超过 Number.MAX_SAFE_INTEGER 精度丢失，
 * 手机端按 MsgRemoteId 查消息，丢精度会回「消息不存在」。
 * @param {string|number} wxid
 * @param {string|number} msgId
 * @param {string|number} msgRemotedId 企微 remote/svr id（查找用）；缺省时回退 msgId
 * @param {number} fileType 下载文件的类型 0 原始文件（原图，视频，音频，文件）
 * @returns {string} TaskId（十进制字符串），用于回包精确匹配
 */
export function downloadFileByMsgIdTask(wxid, msgId, msgRemotedId, fileType) {
  const toIdStr = (v) => {
    if (v == null || v === '') return ''
    return String(v).trim()
  }
  const mid = toIdStr(msgId)
  const rid = toIdStr(msgRemotedId) || mid
  const taskId = generateTaskId()
  const msg = {
    Id: 1212,
    AccessToken: '',
    MsgType: 'DownloadFileByMsgIdTask',
    Content: {
      WxId: wxid != null ? String(wxid) : '',
      // 字符串形式进 JSON，JsonFormat → protobuf int64 不丢精度
      MsgId: mid || '0',
      MsgRemoteId: rid || '0',
      FileType: fileType,
      TaskId: taskId
    }
  }
  sendSock(msg)
  return taskId
}

/**
 * 发朋友圈
 * @param {Object} circle 朋友圈数据
 */
export function postSnsTask(circle) {
  const taskId = generateTaskId()
  const content = {
    WxId: circle.WxId, // 设备企业WX号
    Content: circle.Content, //发布的文案
    // Media: circle.Media, //携带的图片、视频、链接等资源
    // Visible: circle.Visible, // 可见范围
    TaskId: taskId //任务id 在TaskResult中回传
    // Comment : 4, // 评论 TODO: 暂未实现
    //  Poi : 7 // 地理信息 TODO: 暂未实现
  }
  if (circle.Visible) {
    content.Visible = circle.Visible
  }
  if (circle.Media) {
    content.Media = circle.Media
  }
  const msg = {
    Id: 1220,
    AccessToken: '',
    MsgType: 'PostSnsTask',
    Content: content
  }
  sendSock(msg)

  // 60s 无回执兜底：定时链路回执 TaskId 由调度器二次生成，按 WxId 匹配清除
  const key = circle.WxId != null ? String(circle.WxId) : ''
  if (key) {
    clearPostSnsTaskTimeout(key)
    postSnsTaskTimeouts.set(
      key,
      setTimeout(() => {
        postSnsTaskTimeouts.delete(key)
        Message({
          type: 'warning',
          message: '朋友圈发送结果未收到，请检查手机在线状态后重试',
          duration: 4000
        })
      }, POST_SNS_TIMEOUT_MS)
    )
  }
}

/**
 * 获取我的朋友圈列表
 * @param {Number} wxid 微信id
 * @param {Number} seq 起始位置上一条朋友圈的序列号，第一次拉取为-1
 */
export function pullMySnsListTask(wxid, seq = -1) {
  const content = {
    WxId: wxid,
    Seq: seq
  }
  const msg = {
    Id: 1218,
    AccessToken: '',
    MsgType: 'PullMySnsListTask',
    Content: content
  }
  sendSock(msg)
}

/**
 * 获取一条朋友圈内容 返回 GetSnsDataTaskResultNotice
 * @param {Number} wxId 设备企业WX号
 * @param {Number} snsId 朋友圈id
 * @param {String} postId 朋友圈postid
 * @param {Number} taskId 任务id 在TaskResult中回传
 */
export function getSnsDataTask(wxId, snsId, postId, taskId) {
  const content = {
    WxId: wxId,
    SnsId: snsId,
    PostId: postId,
    TaskId: taskId
  }
  const msg = {
    Id: 1226,
    AccessToken: '',
    MsgType: 'GetSnsDataTask',
    Content: content
  }
  sendSock(msg)
}

/**
 * 删除朋友圈
 * @param {Number} wxid 设备企业WX号
 * @param {Number} snsId 朋友圈id
 * @param {Number} postId 朋友圈postid
 * @param {Number} taskId 任务id 在TaskResult中回传
 */
export function delSnsTask(wxid, snsId, postId, taskId) {
  let msg = {
    Id: 1224,
    AccessToken: '',
    MsgType: 'DelSnsTask',
    Content: {
      WxId: wxid,
      SnsId: snsId,
      PostId: postId,
      TaskId: taskId
    }
  }
  sendSock(msg)
}

/**
 * 朋友圈点赞
 * @param {Number} wxid 设备企业WX号
 * @param {Number} snsId 朋友圈id
 * @param {Number} postId 朋友圈postid
 * @param {Number} taskId 任务id 在TaskResult中回传
 */
export function snsLikeTask(wxid, snsId, postId, taskId) {
  let msg = {
    Id: 1222,
    AccessToken: '',
    MsgType: 'SnsLikeTask',
    Content: {
      WxId: wxid,
      SnsId: snsId,
      PostId: postId,
      TaskId: taskId
    }
  }
  sendSock(msg)
}

/**
 * 群管理 / 会话置顶 / 免打扰
 * @param {String} wxid 商家所属微信号
 * @param {String|Number} convId 会话 RemoteId（手机按 remoteId 查；也会回退 localId）
 * @param {Number} action 指令
 * @param {Object} message 指令对应的数据
 * @returns {Number|String} taskId
 */
export function chatRoomActionTask(wxid, convId, action, message = {}) {
  const taskId = message.taskId || message.TaskId || generateTaskId()
  let content = {
    WxId: wxid,
    ConvId: convId,
    Action: action,
    taskId
  }
  if (message.Members) {
    content.Members = message.Members
  }
  // IntValue 可为 0（取消置顶/免打扰），不能用 truthy 判断
  if (message.IntValue != null) {
    content.IntValue = message.IntValue
  }
  if (message.Content) {
    content.Content = message.Content
  }
  let msg = {
    MsgType: 'ChatRoomActionTask',
    Content: content
  }
  console.log('群管理', msg)
  sendSock(msg)
  return taskId
}

/**
 * 触发手机推送联系人列表任务
 * @param {String} wxid 微信id
 * @returns ContactPushNotice DepartmentPushNotice
 */
export function TriggerContactPushTask(wxid) {
  const id = normalizeWxId(wxid)
  if (!id) return false
  let msg = {
    MsgType: 'TriggerContactPushTask',
    Content: { WxId: id }
  }
  return sendSock(msg)
}

/**
 * 触发手机推送客户列表任务
 * @param {String} wxid 微信id
 * @returns CustomerPushNotice UserLabelPushNotice CorporationPushNotice
 */
export function TriggerCustomerPushTask(wxid) {
  let msg = {
    MsgType: 'TriggerCustomerPushTask',
    Content: {
      WxId: wxid
    }
  }
  return sendSock(msg)
}

/**
 * 触发手机推送新客户
 * @param {String} wxid 微信id
 * @returns NewCustomerPushNotice
 */
export function triggerNewCustomerTask(wxid) {
  let msg = {
    MsgType: 'TriggerNewCustomerTask',
    Content: {
      WxId: wxid
    }
  }
  sendSock(msg)
}

/**
 * 通过新客户验证
 * @param {String} wxid 设备企业WX号
 * @param {String} remoteId 联系人id
 * @returns TaskResultNotice
 */
export function acceptCustomerTask(wxid, remoteId) {
  let msg = {
    MsgType: 'AcceptCustomerTask',
    Content: {
      WxId: wxid,
      RemoteId: remoteId,
      TaskId: remoteId
      //   TaskId: generateTaskId()
    }
  }
  sendSock(msg)
}

/**
 * 触发手机推送客户标签
 * @param {String} wxid 微信id
 * @returns UserLabelPushNotice
 */
export function TriggerUserLabelTask(wxid) {
  let msg = {
    MsgType: 'TriggerUserLabelTask',
    Content: {
      WxId: wxid
    }
  }
  sendSock(msg)
}

/**
 * 删除个人标签
 * @param {String} wxid 商家所属企业Wx号
 * @param {Number} labelId 标签id，0则新建标签（如存在同名标签则会失败）
 * @param {String} taskId 任务id
 * @returns TaskResultNotice
 */
export function UserLabelDelTask(wxid, labelId, taskId) {
  let msg = {
    MsgType: 'UserLabelDelTask',
    Content: {
      WxId: wxid,
      LabelId: labelId,
      TaskId: taskId || generateTaskId()
    }
  }
  sendSock(msg)
}

/**
 * 新增或修改个人标签
 * @param {String} wxid 商家所属企业Wx号
 * @param {String} labelName 标签名 id!=0 会修改标签名
 * @param {Number} labelId 标签id，0则新建标签（如存在同名标签则会失败）
 * @param {String} taskId 任务id
 * @returns UserLabelModifyTaskResultNotice
 */
export function UserLabelModifyTask(wxid, labelName, labelId, taskId) {
  let msg = {
    MsgType: 'UserLabelModifyTask',
    Content: {
      WxId: wxid,
      LabelName: labelName,
      LabelId: labelId,
      TaskId: taskId || generateTaskId()
    }
  }
  sendSock(msg)
}

/**
 * 客户）设置标签（基于客户）开发中
 * @param {Number} wxid 商家所属企业Wx号
 * @param {Number} remoteId 联系人id
 * @param {Array} labelId
 * @param {Number} taskId
 * @returns TaskResultNotice
 */
export function UserSetLabelTask(wxid, remoteId, labelId, taskId) {
  let msg = {
    MsgType: 'UserSetLabelTask',
    Content: {
      WxId: wxid,
      RemoteId: remoteId,
      LabelId: labelId,
      TaskId: taskId || generateTaskId()
    }
  }
  sendSock(msg)
}

/**
 * 客户设置标签
 * @param {Object} message 标签信息
 * @returns TaskResultNotice
 */
export function UserLabelSetTask(message) {
  let content = {
    WxId: message.WxId, // 商家所属企业Wx号
    LabelId: message.LabelId, // 标签id
    IsCorp: message.IsCorp, // 是否为公司标签
    TaskId: message.TaskId
  }
  // 新增的客户id
  if (message.AddUsers) {
    content.AddUsers = message.AddUsers
  }
  // 删除的客户id
  if (message.DelUsers) {
    content.DelUsers = message.DelUsers
  }
  let msg = {
    MsgType: 'UserLabelSetTask',
    Content: content
  }
  sendSock(msg)
}

/**
 * 修改客户备注（企微 SetUserMemoTask）
 * @param {String|Number} wxid 设备企微号
 * @param {String|Number} remoteId 联系人 RemoteId
 * @param {String} memo 备注，空字符串表示清空
 * @param {Number} [taskId]
 * @returns TaskResultNotice
 */
export function SetUserMemoTask(wxid, remoteId, memo, taskId) {
  const tid = taskId || generateTaskId()
  const msg = {
    MsgType: 'SetUserMemoTask',
    Content: {
      WxId: wxid,
      RemoteId: remoteId,
      Memo: memo == null ? '' : String(memo),
      TaskId: tid
    }
  }
  sendSock(msg)
  return tid
}

/**
 * 获取联系人信息
 * @param {Number} wxid 设备企业WX号
 * @param {Number} remoteId 联系人id
 * @returns GetContactInfoTaskResultNotice
 */
export function GetContactInfoTask(wxid, remoteId) {
  let msg = {
    MsgType: 'GetContactInfoTask',
    Content: {
      WxId: wxid,
      RemoteId: remoteId
    }
  }
  sendSock(msg)
}

/**
 * 通知手机端执行特定任务
 * @param {Number} wxid 微信id
 * @param {Number} action 指令
 */
export function PhoneActionTask(wxid, action) {
  let content = {
    WxId: wxid,
    Action: action,
    TaskId: generateTaskId()
  }
  sendSock({ MsgType: 'PhoneActionTask', Content: content })
}

/**
 * 查询手机状态
 * @param {String} wxid 商家个人微信内部全局唯一识别码
 * @returns TaskResultNotice
 */
export function PhoneStateTask(wxid) {
  sendSock({
    MsgType: 'PhoneStateTask',
    Content: { WxId: wxid }
  })
}

/**
 * 消息撤回
 * @param {Number} WxId 设备企业WX号
 * @param {Number} RemoteId 消息remoteId
 * @param {Number} TaskId 任务id
 * @returns TaskResult
 */
export function MsgRevokeTask(WxId, RemoteId, TaskId) {
  sendSock({
    MsgType: 'MsgRevokeTask',
    Content: {
      WxId: WxId,
      RemoteId: RemoteId,
      TaskId: TaskId || generateTaskId()
    }
  })
}

/**
 * 单条转发
 * @param {String|Number} WxId 设备企业WX号
 * @param {String|Number} MsgId 消息 remoteId
 * @param {String|Number} ConvId 目标会话 remoteId
 * @param {String|Number} LocalId 目标会话 localId（可选）
 * @param {Number} TaskId 任务 id
 */
export function ForwardMsgTask(WxId, MsgId, ConvId, LocalId = 0, TaskId) {
  return sendSock({
    MsgType: 'ForwardMsgTask',
    Content: {
      WxId,
      MsgId,
      ConvId,
      LocalId: LocalId || 0,
      TaskId: TaskId || generateTaskId()
    }
  })
}

/**
 * 多条转发；Merge=true 为真·合并（需手机 supportsMergeForward）
 * @param {Object} opts
 * @param {String|Number} opts.WxId
 * @param {Array} opts.MsgIds
 * @param {Array} opts.ConvIds
 * @param {Array} [opts.LocalIds]
 * @param {Boolean} [opts.Merge]
 * @param {Number} [opts.TaskId]
 */
export function ForwardMultiTask({ WxId, MsgIds, ConvIds, LocalIds = [], Merge = false, TaskId }) {
  const Content = buildForwardMultiPayload({
    WxId,
    MsgIds,
    ConvIds,
    LocalIds,
    Merge,
    TaskId: TaskId || generateTaskId()
  })
  return sendSock({
    MsgType: 'ForwardMultiTask',
    Content
  })
}

/**
 * 给好友发消息任务
 * @param {Number} WxId 设备企业WX号
 * @param {Number} ConvId 会话 RemoteId
 * @param {String} ContentType 发送消息类型 Text Picture Voice Video Link File NameCard WeApp Quote
 * @param {String} Content 发送消息内容 文本，文件url，链接json，名片wxid
 * @param {Number} RefId 引用消息id
 * @param {Array} AtSomeOne 群聊@某人 0表示@所有人
 * @param {Number} TaskId 发送给手机端的时候需要赋值，
 * @returns TalkToFriendTaskResultNotice
 */
export function TalkToFriendTask(WxId, ConvId, ContentType, Content, RefId = '', AtSomeOne = '', TaskId) {
  const resolvedTaskId = TaskId || generateTaskId()
  let plainContent = typeof Content === 'string' ? Content : Content == null ? '' : String(Content)
  const ct = String(ContentType || '')
  if (ct === 'ShiPinHao' || ct === '25') {
    const prepared = prepareShiPinHaoMaterialContent(plainContent)
    if (!prepared) {
      console.warn('[TalkToFriendTask] 视频号内容不完整，已拦截发送')
      return false
    }
    plainContent = JSON.stringify(prepared)
  }
  let taskContent = {
    WxId: WxId,
    ConvId: ConvId,
    ContentType: ContentType === 25 || ContentType === '25' ? 'ShiPinHao' : ContentType,
    Content: base64.encode(plainContent.replace(/@\S+\u2005/, '')),
    TaskId: resolvedTaskId
  }
  if (AtSomeOne) {
    if (typeof AtSomeOne === 'string') {
      taskContent.AtSomeOne = AtSomeOne.split(',')
    } else if (typeof AtSomeOne === 'object') {
      taskContent.AtSomeOne = AtSomeOne
    }
  }
  if (RefId) {
    taskContent.RefId = RefId
  }

  const doc = {
    ...taskContent,
    Content: buildLocalPlaceholderContent(taskContent.ContentType, plainContent),
    CreateTime: parseInt(new Date().getTime() / 1000, 10),
    MsgId: resolvedTaskId,
    TaskId: resolvedTaskId,
    SenderId: WxId,
    IsSend: true,
    LocalSend: true,
    SenderAccountName:
      (store.state.adminInfo && store.state.adminInfo.account) ||
      (store.state.currentUser && store.state.currentUser.account) ||
      ''
  }
  store.dispatch('conversation/InsertLocalChat', doc)

  const transportBlockReason = getTalkToFriendTransportBlockReason()
  if (transportBlockReason) {
    requestWebSocketReauthOnSendBlocked()
    store.dispatch('conversation/MarkLocalSendFailed', {
      TaskId: resolvedTaskId,
      Success: false,
      ErrMsg: transportBlockReason
    })
    return false
  }

  try {
    sendSock({
      MsgType: 'TalkToFriendTask',
      Content: taskContent
    })
  } catch (error) {
    console.error('TalkToFriendTask WebSocket send failed:', error)
    store.dispatch('conversation/MarkLocalSendFailed', {
      TaskId: resolvedTaskId,
      Success: false,
      ErrMsg: 'WebSocket 发送失败，请重连后重试'
    })
    return false
  }

  const tid = String(resolvedTaskId)
  clearTalkToFriendTaskTimeout(tid)
  const timeoutId = setTimeout(() => {
    talkToFriendTaskTimeouts.delete(tid)
    store.dispatch('conversation/MarkLocalSendFailed', {
      TaskId: resolvedTaskId,
      LocalTimeout: true,
      ErrMsg: '发送超时，请检查手机后重试'
    })
  }, TALK_TO_FRIEND_TIMEOUT_MS)
  talkToFriendTaskTimeouts.set(tid, timeoutId)

  const friend = store.getters['conversation/currentFriend']
  const isGroup = friend && friend.Members && friend.Members.length > 0
  const contentType = String(ContentType || '')
  const fallbackDelayMs = contentType === 'Emoji' ? 2000 : 8000
  setTimeout(() => {
    store.dispatch('conversation/ScheduleOutgoingAckFallback', {
      WxId,
      ConvId,
      TaskId: resolvedTaskId,
      ContentType: contentType,
      ...(isGroup ? { releaseSpinnerOnly: true } : {})
    })
  }, fallbackDelayMs)

  return true
}

/**
 * 打开红包 / 收转账 / 退还转账（WW：WxId / ConvId / MsgRemoteId）
 * @returns TakeMoneyTaskResultNotice
 */
export function TakeLuckyMoneyTask(
  WxId,
  ConvId,
  MsgRemoteId,
  MsgKey,
  TaskId,
  Refuse = false,
  ContentType
) {
  const content = {
    WxId,
    ConvId,
    MsgRemoteId,
    MsgKey,
    TaskId: TaskId || generateTaskId()
  }
  if (Refuse) content.Refuse = true
  if (ContentType != null && ContentType !== '') content.ContentType = ContentType
  return sendSock({
    MsgType: 'TakeLuckyMoneyTask',
    Content: content
  })
}
