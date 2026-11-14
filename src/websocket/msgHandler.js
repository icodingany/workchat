/**
 * WebSocket 消息处理器
 * <p>
 * 核心消息分发中心，根据消息类型（msgType）将服务器推送的消息分发到对应的处理器。
 * <p>
 * <b>消息格式：</b>
 * <pre>
 * {
 *   msgType: 'MessageType',  // 消息类型标识
 *   message: 'JSON String',  // 消息内容（JSON 字符串）
 *   refMsgId: 1001           // 关联的消息 ID（用于响应）
 * }
 * </pre>
 * <p>
 * <b>消息类型分类：</b>
 * <ul>
 *   <li>设备相关：DeviceAuthRsp、AccountForceOfflineNotice</li>
 *   <li>微信状态：WwOnlineNotice、WwOfflineNotice</li>
 *   <li>会话管理：ConversationPushNotice、ConversationAddNotice、ConversationChangedNotice</li>
 *   <li>聊天消息：FriendTalkNotice、TalkToFriendNotice、TalkToFriendTaskResultNotice</li>
 *   <li>朋友圈：PostSnsTaskResultNotice、PullMySnsListTaskResultNotice</li>
 *   <li>联系人：WxFriendPushNotice、ContactPushNotice、CustomerPushNotice</li>
 *   <li>任务：TaskResultNotice</li>
 *   <li>错误：Error</li>
 * </ul>
 */
import store from '../store'

import previewHandle from './handler/previewHandle'
import taskResultNotice from './handler/taskResultNotice'
import { postSnsTaskResultNoticeHandler } from './handler/circleNoticeHandler'

import { ElMessage as Message, ElNotification as Notification } from 'element-plus'
import {
    TriggerUserLabelTask,
    TriggerCustomerPushTask,
    clearTalkToFriendTaskTimeout,
    clearPostSnsTaskTimeout,
    getLastDeviceAuthAttemptTime
} from '@/api/webSocketApi'
import { AddRecordRefundedTransfer } from '@/api/httpApi'
import {
    consume as consumePendingRefuseTask,
    consumeByWxMsgKey as consumePendingRefuseTaskByWxMsgKey
} from '@/utils/pendingRefuseTasks'
import { clearPendingTakeMoneyOnResult } from '@/utils/pendingTakeMoneyTasks'
import { isCurrentWsSessionOwner } from '@/utils/wsSessionOwner'
import { forbidReconnect } from '@/websocket/websocket'
import router from '@/router'
import {
    handleTalkToFriendTaskResult,
    handleTalkToFriendNotice,
    ingestTalkNoticeToStore
} from '@/utils/outgoingAck'

const ELSEWHERE_LOGIN_MSGS = ['账号已在别处登陆', '账号已在别处登录']

function isOnLoginPage() {
    const current = router.currentRoute && router.currentRoute.value
    return !!(current && current.path === '/login')
}

function isElsewhereLoginMsg(msg) {
    if (!msg || typeof msg !== 'string') return false
    return ELSEWHERE_LOGIN_MSGS.some((m) => msg.includes(m))
}

function isSessionExpiredMsg(msg) {
    if (!msg || typeof msg !== 'string') return false
    return /token过期|登录已过期|重新登[录陆]/.test(msg)
}

/** 解析 WS 帧内 message 字段（字符串或已是对象）；失败时尽量提取 TaskResult 关键字段 */
function parseWsMessagePayload(msg) {
    if (!msg || msg.message == null || msg.message === '') return {}
    if (typeof msg.message === 'object') return msg.message
    try {
        return JSON.parse(msg.message)
    } catch (e) {
        const raw = String(msg.message)
        const fallback = {}
        const errMatch = raw.match(/"ErrMsg"\s*:\s*"((?:\\.|[^"\\])*)"/)
        if (errMatch) {
            try {
                fallback.ErrMsg = JSON.parse(`"${errMatch[1]}"`)
            } catch (_) {
                fallback.ErrMsg = errMatch[1]
            }
        }
        const successMatch = raw.match(/"Success"\s*:\s*(true|false)/i)
        if (successMatch) fallback.Success = successMatch[1].toLowerCase() === 'true'
        const taskTypeMatch = raw.match(/"TaskType"\s*:\s*"([^"]+)"/)
        if (taskTypeMatch) fallback.TaskType = taskTypeMatch[1]
        const wxIdMatch = raw.match(/"WxId"\s*:\s*"?([^",}\s]+)"?/)
        if (wxIdMatch) fallback.WxId = wxIdMatch[1]
        const taskIdMatch = raw.match(/"TaskId"\s*:\s*"?([^",}\s]+)"?/)
        if (taskIdMatch) fallback.TaskId = taskIdMatch[1]
        if (Object.keys(fallback).length) {
            console.warn('[ws] message JSON 解析失败，已提取部分字段', fallback)
            return fallback
        }
        throw e
    }
}

/**
 * 主消息处理函数
 * <p>
 * 接收 WebSocket 消息事件，解析消息类型和内容，分发到对应的处理逻辑。
 *
 * @param {MessageEvent} e WebSocket 消息事件对象
 */
export default function handler(e) {
    // 解析消息对象
    let msg = JSON.parse(e.data)
    let msgType = msg.msgType
    let message = msg.message

    // AddTaskTimeInfoResp 的 message 已经是对象，不需要再次解析
    if (msgType !== 'AddTaskTimeInfoResp') {
        message = parseWsMessagePayload(msg)
    }

    // 根据消息类型分发处理
    switch (msgType) {
        // =========================================================================
        // 设备相关消息
        // =========================================================================

        // server 设备(手机客户端、客服客户端)获取通信token响应
        case 'DeviceAuthRsp':
            previewHandle.deviceAuthRspHandler(message)
            break

        // sdk 设备授权后退出(仅用于服务端内部)
        // case 'DeviceExitNotice':
        //   console.log('退出登陆成功')
        //   break

        // sdk 账号强制下线通知
        case 'AccountForceOfflineNotice':
            console.log('账号强制下线通知', msg)
            {
                const loginTime = previewHandle.getLastLoginSuccessTime()
                const authAttemptTime = getLastDeviceAuthAttemptTime()
                const elapsedLogin = loginTime ? Date.now() - loginTime : Infinity
                const elapsedAuth = authAttemptTime ? Date.now() - authAttemptTime : Infinity
                const isRecentLogin = loginTime && elapsedLogin < 30000
                const isRecentAuthAttempt = authAttemptTime && elapsedAuth < 30000
                const isOwner = isCurrentWsSessionOwner()
                if (isOwner && (isRecentLogin || isRecentAuthAttempt)) {
                    console.log('[wsSessionOwner] 当前为最新会话且刚认证，忽略 AccountForceOfflineNotice')
                    break
                }
                if (!isOwner) break
            }
            break

        // =========================================================================
        // 微信状态消息
        // =========================================================================

        // sdk 手机客户端微信上线通知
        case 'WwOnlineNotice':
            previewHandle.wwOnlineNoticeHandler(message)
            break

        // sdk 手机客户端微信下线通知
        case 'WwOfflineNotice':
            previewHandle.wwOfflineNoticeHandler(message)
            break

        // =========================================================================
        // 会话管理消息
        // =========================================================================

        // server 微信列表
        case 'GetWeChatsResp':
            store.commit('conversation/SET_WECHATS', message)
            break

        // sdk 推送聊天会话（包含群聊信息）
        case 'ConversationPushNotice':
            store.commit('conversation/SET_CONVERSATIONS', message)
            break

        // sdk 会话新增通知
        case 'ConversationAddNotice':
            console.log('会话新增通知', message)
            break

        // sdk 会话改变通知
        case 'ConversationChangedNotice':
            store.commit('conversation/CHANGE_CONVERSATIONS', message)
            break

        // =========================================================================
        // 聊天消息
        // =========================================================================

        // sdk 微信好友发来聊天消息
        case 'FriendTalkNotice':
            // electron 新消息闪烁：经 preload window.electronAPI
            if (store.getters.isDesktop && window.electronAPI) {
                window.electronAPI.ipcRenderer.send('operations', 'newMsg')
            }
            ingestTalkNoticeToStore(store, message)
            break

        // sdk 手机上回复好友的聊天消息
        case 'TalkToFriendNotice':
            handleTalkToFriendNotice(store, message)
            break

        // sdk 手机端向服务端通知聊天执行结果
        case 'TalkToFriendTaskResultNotice':
            if (handleTalkToFriendTaskResult(store, message) !== 'ignored') {
                clearTalkToFriendTaskTimeout(message)
            }
            break

        // 消息撤回通知
        case 'MsgRevokeNotice':
            store.commit('conversation/UPDATE_CHAT', message)
            break

        // 开红包 / 收转账 / 退还结果
        case 'TakeMoneyTaskResultNotice': {
            clearPendingTakeMoneyOnResult(message)
            const msgWxId = message.WxId || message.wxId
            const msgMsgKey = message.MsgKey || message.msgKey
            const refuseInfo =
                (message.TaskId != null ? consumePendingRefuseTask(message.TaskId) : null) ||
                (msgWxId && msgMsgKey
                    ? consumePendingRefuseTaskByWxMsgKey(msgWxId, msgMsgKey)
                    : null)
            const isRefundTask = refuseInfo != null
            const amount = Number(message.Amount != null ? message.Amount : message.amount)
            const isTransfer = message.Type === 1 || message.type === 1
            // 红包：Amount<=0 视为假成功，禁止写入 luckMoneyMap（否则气泡「已领取」）
            const credited =
                message.Success && (isRefundTask || isTransfer || (Number.isFinite(amount) && amount > 0))
            if (credited) {
                if (isRefundTask) {
                    Message({ type: 'success', message: '退还成功', duration: 1000 })
                    const wxId = (refuseInfo && refuseInfo.wxId) || msgWxId || ''
                    const msgKey = (refuseInfo && refuseInfo.msgKey) || msgMsgKey
                    if (wxId && msgKey) {
                        store.commit('nedb/ADD_REFUNDED_TRANSFER', { wxId, msgKey })
                        AddRecordRefundedTransfer(wxId, msgKey).catch(() => {})
                    }
                } else {
                    Message({
                        type: 'success',
                        message: isTransfer ? '收款成功！' : '打开红包成功！',
                        duration: 1000
                    })
                    const recTime = message.RecTime || message.recTime
                    if (recTime) message.RecTime = Number(recTime)
                    store.dispatch('nedb/UpdateLuckMoney', {
                        ...message,
                        WxId: msgWxId,
                        MsgKey: msgMsgKey,
                        Amount: amount
                    })
                }
            } else {
                // 未入账/离线/手机失败：统一当失败提示，绝不暗示「已领取」
                const fallback = isRefundTask
                    ? '退还失败'
                    : isTransfer
                      ? '收款失败'
                      : message.Success
                        ? '领取失败：红包未入账'
                        : '领取失败'
                Message({
                    type: 'warning',
                    message: message.ErrMsg || fallback,
                    duration: 3500
                })
            }
            break
        }

        // =========================================================================
        // 朋友圈消息
        // =========================================================================

        // sdk 发朋友圈结果返回
        case 'PostSnsTaskResultNotice':
            clearPostSnsTaskTimeout(message)
            postSnsTaskResultNoticeHandler(message)
            break

        // sdk 获取我的朋友圈列表结果返回
        case 'PullMySnsListTaskResultNotice':
            store.dispatch('circle/SetCircles', message)
            break

        // sdk 获取单个朋友圈结果返回
        case 'GetSnsDataTaskResultNotice':
            store.commit('circle/UPDATE_CIRCLES_BY_ONE', message)
            break

        // =========================================================================
        // 二维码和工具消息
        // =========================================================================

        // sdk 获取二维码结果推送
        case 'PullMyQrCodeTaskResultNotice':
            store.commit('tools/UPDATE_QR_CODE', message)
            break

        // sdk 微信好友列表推送，用于从微信好友中添加客户
        case 'WxFriendPushNotice':
            store.commit('tools/SET_WX_FRIENDS', message)
            break

        // 好友信息
        case 'GetContactInfoTaskResultNotice':
            store.dispatch('conversation/UpdateFriend', message)
            break

        // 手机端推送新客户列表
        case 'NewCustomerPushNotice':
            store.commit('tools/SET_NEW_FRIENDS', message)
            break

        // =========================================================================
        // 标签管理消息
        // =========================================================================

        // 推送客户标签
        case 'UserLabelPushNotice':
            store.commit('conversation/UPDATE_USER_LABELS', message)
            break

        // 客户标签变化推送：拉标签定义 + 客户列表（含备注/打标）
        case 'UserLabelChangedNotice':
            console.log('UserLabelChangedNotice', message)
            TriggerUserLabelTask(message.WxId)
            TriggerCustomerPushTask(message.WxId)
            break

        // 新增或修改个人标签结果返回
        case 'UserLabelModifyTaskResultNotice':
            TriggerUserLabelTask(message.WxId)
            break

        // =========================================================================
        // 企业联系人和部门
        // =========================================================================

        // sdk 手机端推送企业联系人
        case 'ContactPushNotice':
            store.dispatch('conversation/UpdateContacts', message)
            break

        // sdk 手机端推送部门信息列表
        case 'DepartmentPushNotice':
            if (message.Departs && message.Departs.length > 0) {
                store.dispatch('conversation/UpdateDepartments', message)
            }
            break

        // sdk 手机端推送我的客户
        case 'CustomerPushNotice':
            store.dispatch('conversation/UpdateCustomers', message)
            break

        // 单向客户（僵尸粉检测）
        case 'OneWayCustomerPushNotice': {
            const wxId = message.WxId || (message.Content && message.Content.WxId)
            const ids = (message.Ids || (message.Content && message.Content.Ids) || []).map(String)
            if (wxId && ids.length) {
                store.commit('tools/APPEND_RECENT_ONE_WAY', { wxId, ids })
            }
            break
        }

        // =========================================================================
        // 历史消息和公司信息
        // =========================================================================

        // 历史消息推送
        case 'HistoryMsgPushNotice':
            console.log('HistoryMsgPushNotice', message)
            store.dispatch('conversation/AddChatsByHistory', message)
            store.dispatch('nedb/SetLuckMoneyMap')
            if (message.WxId) {
                store.dispatch('nedb/SyncBackendLuckMoneyRefundState', message.WxId)
            }
            break

        // sdk 推送客户公司信息
        case 'CorporationPushNotice':
            if (message.Corps && message.Corps.length > 0) {
                store.dispatch('conversation/UpdateCorporations', message)
            }
            break

        // 文件下载任务或手机端自动下载结果推送
        case 'DownloadFileResultNotice':
            store.commit('conversation/UPDATE_CHATS_BY_DETAIL', message)
            break

        // 新客户变更通知(别人申请加你为好友)
        case 'NewCustomerAddedNotice':
            Notification({
                title: '通知',
                message: `${store.getters['conversation/wechatsNameMap'][message.WxId] || message.WxId}有人加你为好友！`
            })
            break

        // sdk 查询手机状态返回结果
        case 'PhoneStateTaskResultNotice':
            store.commit('tools/SET_PHONE_STATE', message)
            break

        // =========================================================================
        // 任务消息
        // =========================================================================

        // sdk 任务执行结果通知
        case 'TaskResultNotice':
            taskResultNotice.taskResultMap(message)
            break

        // =========================================================================
        // 未实现的接口
        // =========================================================================

        // sdk 联系人新增，未实现
        case 'ContactAddNotice':
            // conversationHandle.conversationPushNoticeHandle(msg)
            break

        // sdk 联系人删除，未实现
        case 'ContactDelNotice':
            // conversationHandle.conversationPushNoticeHandle(msg)
            break

        // sdk 客户新增，未实现
        case 'CustomerAddNotice':
            // conversationHandle.conversationPushNoticeHandle(msg)
            break

        // sdk 客户删除，未实现
        case 'CustomerDelNotice':
            // conversationHandle.conversationPushNoticeHandle(msg)
            break

        // sdk 部门信息变化推送，未实现
        case 'DepartmentChangedNotice':
            // conversationHandle.conversationPushNoticeHandle(msg)
            break

        // sdk 手机上消息已读（清本地未读角标；服务端同步清 Redis 快照）
        case 'PostMessageReadNotice':
            store.dispatch('conversation/SetConvReaded', {
                WxId: message.WxId,
                ConvId: message.ConvId != null ? message.ConvId : message.Id,
                Id: message.ConvId != null ? message.ConvId : message.Id
            })
            break

        // =========================================================================
        // 服务端回调
        // =========================================================================

        // server 返回消息确认
        case 'MsgReceivedAck':
            switch (msg.refMsgId) {
                case 1001:
                    // console.log('心跳返回。。。')
                    break
                default:
                    // console.log('服务端收到指令返回')
                    break
            }
            break

        // =========================================================================
        // 错误处理
        // =========================================================================

        // 错误消息
        case 'Error':
            {
                let errMsg = JSON.parse(msg.message)
                let errorCode = errMsg.ErrorCode
                let errorMsg = errMsg.ErrorMsg
                const isPwdError = errMsg.ErrorCode === 'NoRight' && errorMsg === '账号密码错误'
                const isSessionError =
                    errMsg.ErrorCode === 'NoRight' &&
                    (isElsewhereLoginMsg(errorMsg) || isSessionExpiredMsg(errorMsg))

                // 统一登录期间任何 WS 错误都视为 wsFailed：
                // - NoRight 密码错误：原本就处理
                // - InvalidParam 解码失败等：后端 DeviceAuthReqWebsocketHandler 在 credential
                //   split(":") 越界时会返回此错误（type=0 管理员走 WS 路径时会触发，
                //   见 DeviceAuthReqWebsocketHandler.handleMsg 行 76）。这种情况前端无法修复，
                //   唯一可行的是让 HTTP 登录的管理员仍能进 admin，所以标 wsFailed 让
                //   tryCompleteUnifiedLogin 走 "WS 失败 + HTTP 成功 → admin" 分支。
                if (store.state.unifiedLogin && store.state.unifiedLogin.pending) {
                    store.commit('SET_UNIFIED_LOGIN_WS_FAILED')
                    store.dispatch('tryCompleteUnifiedLogin')
                    // 统一登录期间的错误统一静默（避免弹框干扰），console.log 保留供排查
                    console.log('WS 登录失败（统一登录期间静默）:', errMsg)
                    break
                }

                // 刷新后 tryAutoDeviceAuth 失败：静默（管理端 httpToken 仍可用），避免弹「解码失败」
                let autoDeviceAuthPending = false
                try {
                    autoDeviceAuthPending = sessionStorage.getItem('autoDeviceAuthPending') === '1'
                    if (autoDeviceAuthPending) sessionStorage.removeItem('autoDeviceAuthPending')
                } catch (e) {
                    /* ignore */
                }
                if (autoDeviceAuthPending) {
                    store.commit('websocket/SET_LOGIN_LOADING', false)
                    console.warn('刷新自动补登 WS 失败（已静默）:', errMsg)
                    break
                }

                // 非统一登录（如管理端补登客服端）：结束 loading，便于调用方 watch 收尾
                store.commit('websocket/SET_LOGIN_LOADING', false)

                if (isSessionError) {
                    const loginTime = previewHandle.getLastLoginSuccessTime()
                    const authAttemptTime = getLastDeviceAuthAttemptTime()
                    const elapsedLogin = loginTime ? Date.now() - loginTime : Infinity
                    const elapsedAuth = authAttemptTime ? Date.now() - authAttemptTime : Infinity
                    const isRecentLogin = loginTime && elapsedLogin < 30000
                    const isRecentAuthAttempt = authAttemptTime && elapsedAuth < 30000
                    const isOwner = isCurrentWsSessionOwner()
                    const tokenExpired = isSessionExpiredMsg(errorMsg)

                    // 登录页 / token 过期：静默清凭证，不弹窗
                    if (isOnLoginPage() || tokenExpired) {
                        forbidReconnect()
                        store.commit('SET_WEBSOCKET_TOKEN', '')
                        if (typeof localStorage !== 'undefined') {
                            localStorage.removeItem('validateToken')
                        }
                        console.log('WS 会话过期已静默处理:', errMsg)
                        break
                    }

                    // 当前会话刚登录/刚发起认证：消息来自被挤掉的旧连接，保留当前账号
                    if (isOwner && (isRecentLogin || isRecentAuthAttempt)) {
                        console.log(
                            '[wsSessionOwner] 当前为最新会话且刚认证，忽略「别处登录」(login=' +
                                Math.round(elapsedLogin) +
                                'ms auth=' +
                                Math.round(elapsedAuth) +
                                'ms)'
                        )
                        break
                    }

                    // 非 holder Tab：旧连接或旁观 Tab，静默忽略
                    if (!isOwner) {
                        break
                    }

                    // 真正被踢：轻提示 + 清 token，禁止自动重连（对齐 kelailaichatpc）
                    const hasWsToken = !!store.state.webSocketToken
                    if (hasWsToken) {
                        Message({
                            type: 'warning',
                            message: '已经在别处登录请留意！',
                            duration: 3000
                        })
                    }
                    forbidReconnect()
                    store.commit('SET_WEBSOCKET_TOKEN', '')
                    if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem('validateToken')
                    }
                } else if (!isPwdError || !store.state.unifiedLogin.pending) {
                    // 登录页或会话过期类错误：静默，只展示登录页
                    if (isOnLoginPage() || isSessionExpiredMsg(errorMsg)) {
                        console.log('WS 错误已静默（登录页/会话过期）:', errMsg)
                        break
                    }
                    // 参数类错误多为后台 GetWeChatsReq/Trigger 空字段，刷新会话时不弹窗打扰
                    // 但开红包解析失败等业务错误必须提示（否则只剩「等待手机」无后续）
                    if (
                        errorCode === 'InvalidParam' &&
                        (errorMsg === '解码失败' ||
                            errorMsg === '参数传入错误' ||
                            errorMsg === 'Content消息类型传入错误')
                    ) {
                        console.warn('WS 参数错误（已静默）:', errMsg)
                        break
                    }
                    if (
                        errorCode === 'InvalidParam' &&
                        typeof errorMsg === 'string' &&
                        (errorMsg.indexOf('开红包') >= 0 || errorMsg.indexOf('转账') >= 0)
                    ) {
                        Message({
                            type: 'warning',
                            message: errorMsg,
                            duration: 3500
                        })
                        break
                    }
                    console.log(errMsg)
                    Message.error({
                        type: 'error',
                        message: errorMsg,
                        duration: 2000,
                        showClose: true
                    })
                }
            }
            break

        // 未知的消息类型
        default:
            console.log('未知的任务', msg)
            break
    }
}
