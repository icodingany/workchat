import fetch from '@/utils/fetch'
import { generateTaskId } from '@/utils/common'

/**
 * 解析 PC 端 /pc/* 接口使用的账号 id（tbl_accountinfo.id，即 WebSocket Extra.UnionId）
 * @param {number|string|object} source UnionId 或 currentUser / adminInfo 对象
 * @returns {number|null}
 */
export function resolvePcAccountId(source) {
  if (source == null) return null
  let raw = source
  if (typeof source === 'object' && !Array.isArray(source)) {
    raw =
      source.UnionId ??
      source.unionId ??
      source.Id ??
      source.id ??
      source.AccountId ??
      source.accountId
  }
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

/**
 * 获取企微号列表（HTTP 首屏，比 WS GetWeChatsReq 更快）
 * @param {number|string|object} accountId UnionId 或 currentUser
 */
export function GetWeChatsReq(accountId) {
  const id = resolvePcAccountId(accountId)
  if (!id) {
    return Promise.reject({ code: -1, msg: '用户账号信息无效，请重新登录' })
  }
  return fetch.post('/pc/GetWeChatsReq', { id })
}

/**
 * 获取公共标签
 * @param {number} uionId 用户id
 */
export function getCommonTags(uionId) {
  return fetch.post('/pc/GetCommonTags', { id: uionId, name: 'pc' })
}

/**
 * 获取公共话术
 * @param {number} uionId 用户id
 */
export function getCommonTerms(uionId) {
  return fetch.post('/pc/GetCommonTerms', { id: uionId, name: 'pc' })
}

/**
 * 定时任务
 * @param {object} message 参数太多以{}的方式传参
 */
export function addTaskTimeInfo(message = {}) {
  const { ...content } = message
  content.TaskId = generateTaskId()
  return fetch.post('/pc/AddTaskTimeInfo', content)
}

/**
 * 查询定时任务的结果（cid 由后端按 accountid 解析）
 * @param {number} accountid 登录的时候已经下发unionid
 * @param {number} page 当前第几页 从1开始
 * @param {number} rows 每页多少条
 * @param {number} tasktype 非必传
 * @param {number} state 非必传
 */
export function getTaskInfoList(accountid, page, rows, tasktype = null, state = null) {
  let xhr = {
    accountid: accountid,
    page: page,
    rows: rows
  }
  if (tasktype) {
    xhr.tasktype = tasktype
  }
  if (state) {
    xhr.state = state
  }
  return fetch.post('/pc/GetTaskInfoList', xhr)
}

/**
 * 定时任务详情统计
 * @param {Number} id 定时主任务id
 */
export function getTaskDetail(id) {
  return fetch.post('/pc/TaskDetail', {
    id: id
  })
}

/**
 * 定时任务状态更改接口
 * @param {Number} id 定时主任务id
 * @param {Number} state  状态   -1暂停     1开启中     0已完成       2取消
 */
export function updateTaskState(id, state) {
  return fetch.post('/pc/TaskStateUpdate', {
    id: id,
    state: state
  })
}

/**
 * 查询号码
 */
export function getPhoneNumberList(wechatid, phonenumber, begin_time, end_time, pageNo, pageSize) {
  return fetch.post('/pc/GetPhoneNumberList', {
    wechatid: wechatid,
    phonenumber: phonenumber,
    begin_time: begin_time,
    end_time: end_time,
    pageNo: pageNo,
    pageSize: pageSize
  })
}

/**
 * 获取自动任务的配置文件（cid 由后端解析）
 * @param {String} wechatId 微信id
 * @param {Number} auto_type 任务类型 2001自动回复 2002自动拉群
 */
export function autoTaskDetailList(wechatId, auto_type) {
  return fetch.post('/pc/AutoTaskDetailList', { wechatId: wechatId, auto_type: auto_type })
}

/**
 * 更新自动任务的配置文件（cid 由后端解析）
 */
export function autoTaskUpdate(wechatId, auto_type, state, remarks) {
  return fetch.post('/pc/AutoTaskUpdate', {
    wechatId: wechatId,
    auto_type: auto_type,
    state: state,
    remarks: remarks
  })
}

/**
 * 查询关键词自动回复（cid 由后端从登录态取）
 */
export function getAutoReplyList(wechatid, keyWord, keyType, resourceType, page, rows) {
  return fetch.post('/user/keyWords/pageList', {
    wechatid: wechatid,
    keyWord: keyWord,
    keyType: keyType,
    resourceType: resourceType,
    page: page,
    rows: rows
  })
}

/**
 * 添加关键词回复
 */
export function addReply(wechatid, keyWord, keyType, resourceType, returnString) {
  return fetch.post('/user/keyWords/add', {
    wechatid: wechatid,
    keyWord: keyWord,
    keyType: keyType,
    resourceType: resourceType,
    returnString: returnString
  })
}

/**
 * 修改关键词回复
 */
export function updateReply(id, wechatid, keyWord, keyType, resourceType, returnString) {
  return fetch.post('/user/keyWords/update', {
    id: id,
    wechatid: wechatid,
    keyWord: keyWord,
    keyType: keyType,
    resourceType: resourceType,
    returnString: returnString
  })
}

/**
 * 删除关键词回复
 */
export function deleteReply(ids) {
  return fetch.post('/user/keyWords/deletes', {
    ids: ids
  })
}

/**
 * 素材库列表查询
 */
export function resourcesList(pageNo, pageSize, type = null) {
  return fetch.post('/user/resources/pageList', {
    type: type,
    page: pageNo,
    rows: pageSize
  })
}

/**
 * 删除素材
 */
export function deleteResources(ids) {
  return fetch.post('/user/resources/deletes', {
    ids: ids
  })
}

/**
 * 添加素材
 */
export function addResources(content, type, remarks = '') {
  return fetch.post('/user/resources/add', {
    content: content,
    type: type,
    remarks: remarks
  })
}

/**
 * 文本翻译（腾讯云 TMT，服务端 target 固定 zh）
 * @param {string} sourceText
 * @param {string} [source=auto]
 */
export function textTranslate(sourceText, source = 'auto') {
  return fetch.post('/pc/translate/textTranslate', {
    sourceText,
    source
  })
}

/**
 * 更新素材
 */
export function updateResources(id, type, content, remarks = '') {
  return fetch.post('/user/resources/update', {
    id: id,
    type: type,
    content: content,
    remarks: remarks
  })
}

/**
 * 查询聊天记录（cid 由后端从登录态取）
 */
export function queryChatHistory(WxId, FriendWxid, Content, page, rows, start, end) {
  return fetch.post('/user/message/pageList', {
    WxId: WxId,
    FriendWxid: FriendWxid,
    Content: Content,
    page: page,
    rows: rows,
    start: start,
    end: end
  })
}

/**
 * 管理端触发手机推送会话历史（无 WS 时的兜底）
 */
export function triggerHistoryPull(WxId, FriendWxid) {
  return fetch.post('/user/message/triggerHistory', {
    WxId: WxId,
    FriendWxid: FriendWxid
  })
}

/**
 * 游标分页拉取更早聊天记录（上滑主路径）
 * @param {Object} params
 * @param {string|number} params.wxId
 * @param {string|number} params.convId
 * @param {number} [params.beforeTime] 毫秒上界 exclusive
 * @param {string} [params.cursor] 上一页 next_cursor
 * @param {number} [params.limit=20]
 */
export function fetchChatHistoryCursor({ wxId, convId, beforeTime, cursor, limit = 20 }) {
  const query = {
    wx_id: wxId,
    conv_id: convId,
    limit
  }
  if (cursor) {
    query.cursor = cursor
  } else if (beforeTime != null && beforeTime !== '') {
    query.before_time = beforeTime
  }
  return fetch.get('/user/message/history', query)
}

/**
 * 查询会话毫秒覆盖段与待补空洞（对齐 wei-kefu-be /coverage）
 */
export function getChatHistoryCoverage({ wxId, convId, fromMs, toMs }) {
  return fetch.get('/user/message/coverage', {
    wx_id: wxId,
    conv_id: convId,
    from_ms: fromMs,
    to_ms: toMs
  })
}

/**
 * 按覆盖空洞时间窗补拉消息
 */
export function fetchCoverageGapMessages({ wxId, convId, beginMs, endMs, limit = 20 }) {
  return fetch.get('/user/message/coverageGap', {
    wx_id: wxId,
    conv_id: convId,
    begin_ms: beginMs,
    end_ms: endMs,
    limit
  })
}

/**
 * 标记空缺口已探测（通常由 coverageGap 空结果自动完成；手动兜底）
 */
export function markChatHistoryCoverage({ wxId, convId, beginMs, endMs }) {
  return fetch.post('/user/message/coverage/mark', {
    wx_id: wxId,
    conv_id: convId,
    begin_ms: beginMs,
    end_ms: endMs
  })
}

/**
 * 查询消息标识
 */
export function queryMessageTag(wechatid, friendwechatid, msgserverid, type = '1') {
  return fetch.post('/user/messageTag/query', {
    wechatid: wechatid,
    friendwechatid: friendwechatid,
    msgserverid: msgserverid,
    type: type
  })
}

/**
 * 添加消息标识
 */
export function addMessageTag(wechatid, friendwechatid, msgserverid, type = '1') {
  return fetch.post('/user/messageTag/add', {
    wechatid: wechatid,
    friendwechatid: friendwechatid,
    msgserverid: msgserverid,
    type: type
  })
}

/**
 * 会话列表 Redis 镜像（首屏 HTTP，免等手机推送）
 * @param {Object} params
 * @param {string|number} params.wxId
 * @param {number} [params.limit=30]
 * @param {number} [params.offset=0]
 * @param {boolean} [params.countOnly=false]
 */
export function fetchConversationSnapshot(params) {
  const { wxId, limit = 30, offset = 0, countOnly = false } = params || {}
  const searchParams = new URLSearchParams({
    wxId: String(wxId),
    offset: String(offset)
  })
  if (countOnly) {
    searchParams.set('count_only', 'true')
  } else {
    searchParams.set('limit', String(limit))
  }
  return fetch.get(`/pc/conversations/snapshot?${searchParams.toString()}`)
}

/** 僵尸粉标签：确保标签存在 */
export function ensureZombieLabel(wxId, labelName = '僵尸粉') {
  return fetch.post('/user/zombie-label/ensure', { wxId, labelName })
}

/**
 * 我的客户/企业通讯录同步状态轮询（点击「刷新/同步」下发 Trigger 后调用）
 * @param {String|Number} wxId 企微 wxId
 * @param {String} type customer=我的客户 / contact=企业通讯录
 * @returns {Promise} ResultInfo{code,msg,data:{state,startTime,endTime,errorMsg}}
 */
export function fetchContactSyncStatus(wxId, type = 'customer') {
  return fetch.post('/pc/GetContactSyncStatus', { wxId: String(wxId), type })
}

/** 僵尸粉标签：批量打标 */
export function applyZombieLabel(wxId, friendIds, labelName = '僵尸粉', labelId) {
  const payload = { wxId, friendIds, labelName }
  if (labelId != null) payload.labelId = labelId
  return fetch.post('/user/zombie-label/apply', payload)
}

/** 僵尸粉标签：查询 job */
export function getZombieLabelJob(jobId) {
  return fetch.post('/user/zombie-label/job', { jobId })
}

/** 个人话术：分组+话术树 */
export function getAccountTermsDetail() {
  return fetch.get('/pc/terms/types/detail')
}

export function addAccountTermType({ name, parentId, tagColor }) {
  return fetch.post('/pc/terms/types/add', { name, parentId, tagColor })
}

export function updateAccountTermType({ id, name, tagColor }) {
  return fetch.post('/pc/terms/types/update', { id, name, tagColor })
}

export function deleteAccountTermType(id) {
  return fetch.post('/pc/terms/types/delete', { id })
}

export function addAccountTerm({ groupId, name, content, ctype, isMulti, messagesJson }) {
  return fetch.post('/pc/terms/add', { groupId, name, content, ctype, isMulti, messagesJson })
}

export function updateAccountTerm({ id, name, content, tid, isMulti, messagesJson }) {
  return fetch.post('/pc/terms/update', { id, name, content, tid, isMulti, messagesJson })
}

export function deleteAccountTerm(id) {
  return fetch.post('/pc/terms/delete', { id })
}

export function getAccountTermDetail(id) {
  return fetch.get(`/pc/terms/detail?id=${encodeURIComponent(id)}`)
}

/** 已领取红包/转账 MsgKey 列表（后端未就绪时调用方可 catch 兜底） */
export function GetClaimedLuckyMoneyKeys(wxId) {
  return fetch.post('/user/luckymoney/claimedKeys', { wxId })
}

/** 已退还转账 MsgKey 列表 */
export function GetRefundedTransferKeys(wxId) {
  return fetch.post('/user/luckymoney/refundedKeys', { wxId })
}

/** 退还成功 HTTP 兜底入库 */
export function AddRecordRefundedTransfer(wxId, msgKey) {
  return fetch.post('/user/luckymoney/addRefunded', { wxId, msgKey })
}
