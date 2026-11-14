/**
 * 本地「发送中」预览：转圈判定与 TalkToFriendTaskResult 补 MsgId / 失败态。
 * 从 conversation store 抽出，便于单测且避免 mochapack 拉整条 Vue 链。
 */
import { getTaskIdLookupKeys } from '@/utils/taskIdLookupKeys'
import { pickChatField } from '@/utils/chatMessageFields'

/** 企微 EnumSendStatus.SendError；SCRM 在 Flag 上叠加此位表示「手机端发送失败」 */
export const ENUM_SEND_ERROR = 0x10
export const FLAG_SEND_FAIL = 0x10000
/** PC 本地发送失败（TalkToFriend 回执/超时） */
export const LOCAL_SEND_FAIL_STATUS = 5

/**
 * 是否出站媒体类型
 * @param {string|number} ct
 */
export function isOutgoingMediaContentType(ct) {
  const t = ct
  return (
    t === 'Picture' || t === 2 || t === '2' ||
    t === 'Video' || t === 4 || t === '4' ||
    t === 'Voice' || t === 3 || t === '3' ||
    t === 'File' || t === 8 || t === '8' ||
    t === 'Emoji' || t === 14 || t === '14'
  )
}

/**
 * Result / Notice 是否已带服务端回执 id（MsgId 或 MsgRemoteId）。
 * @param {object} message
 * @returns {boolean}
 */
export function hasOutgoingMessageReceipt(message = {}) {
  const msgId = message.MsgId != null && message.MsgId !== '' && String(message.MsgId) !== '0'
  const remote =
    message.MsgRemoteId != null &&
    message.MsgRemoteId !== '' &&
    String(message.MsgRemoteId) !== '0'
  return msgId || remote
}

/**
 * TalkToFriendTaskResultNotice 是否成功（兼容 success 小写、数字 1、以及 Success 缺省但有 MsgId）。
 * @param {object} message
 * @returns {boolean}
 */
export function isTalkToFriendTaskResultSuccess(message = {}) {
  const value = message.Success ?? message.success
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return hasOutgoingMessageReceipt(message)
}

/**
 * 仅当回执明确失败时才标红点；Success 缺省且无 MsgId 时交给 8s/20s 兜底，避免误标。
 * @param {object} message
 * @returns {boolean}
 */
export function isExplicitTalkToFriendTaskResultFailure(message = {}) {
  const value = message.Success ?? message.success
  return value === false || value === 'false' || value === 0 || value === '0'
}

/**
 * 将 History / TalkNotice 上的发送失败 Flag 规范化为 Flag + Status=5，便于红点渲染。
 * protobuf JSON 常把 Flag 写成 flag（小写）。
 * @param {object} chat
 * @returns {object}
 */
export function normalizeSendFailChat(chat) {
  if (!chat || typeof chat !== 'object') return chat
  const raw = chat.Flag != null ? chat.Flag : chat.flag
  const flag = Number(raw)
  if (!Number.isFinite(flag) || (flag & FLAG_SEND_FAIL) !== FLAG_SEND_FAIL) {
    if (chat.Flag == null && chat.flag != null) return { ...chat, Flag: chat.flag }
    return chat
  }
  return {
    ...chat,
    Flag: flag,
    Status: LOCAL_SEND_FAIL_STATUS
  }
}

/**
 * 是否发送失败（应对齐企微红点）：
 * - Status=5：PC 本地失败
 * - Status=0x10：协议 EnumSendStatus.SendError
 * - Flag & 0x10000：手机 hook 把 state 失败编码进 Flag 后同步上来
 * @param {Object} chat
 * @returns {boolean}
 */
export function isSendFailedChat(chat) {
  if (!chat) return false
  const st = Number(chat.Status)
  if (st === LOCAL_SEND_FAIL_STATUS || st === ENUM_SEND_ERROR) return true
  const flag = Number(chat.Flag != null ? chat.Flag : chat.flag)
  if (Number.isFinite(flag) && (flag & FLAG_SEND_FAIL) === FLAG_SEND_FAIL) return true
  return false
}

/**
 * 本地「发送中」预览是否仍显示转圈：无 MsgId 且无 MsgRemoteId，且非发送失败。
 * @param {Object} chat
 * @returns {boolean}
 */
export function isLocalSendingChat(chat) {
  if (!chat) return false
  if (chat.PendingSync) return false
  if (isSendFailedChat(chat)) return false
  return chat.LocalSend === true
}

/**
 * 在本地消息列表中查找「发送中」预览下标。
 * TaskId 用字符串比较（兼容 number/string）；TaskId 为空/0 时可用 MsgId/MsgRemoteId 回退。
 * @param {Array} messages
 * @param {{ TaskId?: any, MsgId?: any, MsgRemoteId?: any }} key
 * @returns {number}
 */
export function findLocalPreviewIndex(messages, key) {
  if (!messages || !messages.length || !key) return -1
  const payloadTaskKeys = new Set(
    [...getTaskIdLookupKeys(key.TaskId), ...getTaskIdLookupKeys(key.taskId)].filter(
      (k) => k && k !== '0'
    )
  )
  if (payloadTaskKeys.size > 0) {
    const byTask = messages.findIndex((x) => {
      if (!x || x.TaskId == null || x.TaskId === '' || String(x.TaskId) === '0') return false
      return getTaskIdLookupKeys(x.TaskId).some((k) => payloadTaskKeys.has(k))
    })
    if (byTask >= 0) return byTask
  }
  // Notice 偶发 TaskId=0，但 Result 已给本地预览补过 MsgId/MsgRemoteId
  const msgId = key.MsgId !== undefined && key.MsgId !== null && key.MsgId !== '' ? String(key.MsgId) : ''
  const remoteId =
    key.MsgRemoteId !== undefined && key.MsgRemoteId !== null && key.MsgRemoteId !== ''
      ? String(key.MsgRemoteId)
      : ''
  if (!msgId && !remoteId) return -1
  return messages.findIndex((x) => {
    if (!x || x.TaskId == null || x.TaskId === '') return false
    if (msgId && x.MsgId != null && x.MsgId !== '' && String(x.MsgId) === msgId) return true
    if (remoteId && x.MsgRemoteId != null && x.MsgRemoteId !== '' && String(x.MsgRemoteId) === remoteId) {
      return true
    }
    return false
  })
}

/**
 * TalkToFriendTaskResultNotice 成功时：给本地预览补 MsgId/MsgRemoteId，停转圈但不删内容
 * （避免 Result 先到、TalkToFriendNotice 未到时图片空白）。
 * @param {Array} messages
 * @param {Object} result
 * @returns {Array}
 */
export function applyTalkResultToLocalMessages(messages, result) {
  if (!messages || !messages.length || !result) return messages || []
  if (!isTalkToFriendTaskResultSuccess(result)) return messages
  const idx = findLocalPreviewIndex(messages, result)
  if (idx < 0) return messages
  const next = messages.slice()
  const cur = next[idx] || {}
  const patched = {
    ...cur,
    MsgId: result.MsgId != null && result.MsgId !== '' ? result.MsgId : cur.MsgId,
    MsgRemoteId:
      result.MsgRemoteId != null && result.MsgRemoteId !== '' ? result.MsgRemoteId : cur.MsgRemoteId,
    CreateTime: result.CreateTime || cur.CreateTime
  }
  if (hasOutgoingMessageReceipt(patched)) {
    patched.LocalSend = false
    patched.PendingSync = false
    const flag = Number(patched.Flag != null ? patched.Flag : patched.flag) || 0
    if (
      Number(patched.Status) === LOCAL_SEND_FAIL_STATUS &&
      (flag & FLAG_SEND_FAIL) !== FLAG_SEND_FAIL
    ) {
      delete patched.Status
      delete patched.SendFailReason
    }
  }
  next[idx] = patched
  return next
}

/**
 * 8s 兜底：设备已收任务但回执慢，释放转圈进入 PendingSync。
 * @param {Array} messages
 * @param {{ TaskId?: any }} payload
 * @returns {Array}
 */
export function markLocalPendingSyncInMessages(messages, payload) {
  if (!messages || !messages.length || !payload) return messages || []
  const idx = findLocalPreviewIndex(messages, payload)
  if (idx < 0) return messages
  const cur = messages[idx]
  if (!cur || !cur.LocalSend || cur.PendingSync) return messages
  const next = messages.slice()
  next[idx] = {
    ...cur,
    LocalSend: false,
    PendingSync: true
  }
  return next
}

/**
 * TalkToFriendTaskResultNotice 失败：本地预览标 Status=5，停转圈，保留内容。
 * TaskId/MsgId 对不上时回退到最后一条仍在发送中的预览（失败回包常带 TaskId=0）。
 * @param {Array} messages
 * @param {{ TaskId?: any, ErrMsg?: string, errMsg?: string, Message?: string, message?: string }} result
 * @returns {Array}
 */
export function markLocalSendFailedInMessages(messages, result) {
  if (!messages || !messages.length || !result) return messages || []
  let idx = findLocalPreviewIndex(messages, result)
  if (idx < 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (isLocalSendingChat(messages[i]) || (messages[i] && (messages[i].LocalSend || messages[i].PendingSync))) {
        idx = i
        break
      }
    }
  }
  if (idx < 0) return messages
  const cur = messages[idx]
  if (!isLocalSendingChat(cur)) {
    const pendingSync = cur && cur.PendingSync === true
    if (!pendingSync) return messages
  }
  const errRaw = result.ErrMsg || result.errMsg || result.Message || result.message || ''
  const text = typeof errRaw === 'string' && errRaw.trim() ? errRaw.trim() : '发送失败'
  const next = messages.slice()
  next[idx] = {
    ...cur,
    LocalSend: false,
    PendingSync: false,
    Status: LOCAL_SEND_FAIL_STATUS,
    SendFailReason: text
  }
  return next
}

/**
 * UI：是否展示发送失败红点（可点击重发）
 * @param {Object} chat
 * @returns {boolean}
 */
export function shouldShowSendFailResend(chat) {
  return isSendFailedChat(chat)
}

/**
 * TalkToFriendNotice 常 Content 为空（WS 瘦身）；入库前从匹配的本地预览补正文，避免被 skip 丢弃。
 * @param {Array} messages 当前会话消息
 * @param {object} notice 已 normalize 的 Notice
 * @returns {object}
 */
export function enrichOutgoingNoticeFromLocalPreview(messages, notice) {
  if (!notice || !messages || !messages.length) return notice
  const idx = findLocalPreviewIndex(messages, notice)
  if (idx < 0) return notice
  const local = messages[idx]
  if (!local) return notice

  const out = { ...notice }
  const copyIfEmpty = (targetKey, ...sourceKeys) => {
    const cur = pickChatField(out, ...sourceKeys)
    if (cur != null && cur !== '') return
    const fromLocal = pickChatField(local, ...sourceKeys)
    if (fromLocal != null && fromLocal !== '') {
      out[targetKey] = fromLocal
    }
  }
  copyIfEmpty('Content', 'Content', 'content')
  copyIfEmpty('Url', 'Url', 'url')
  copyIfEmpty('Ext', 'Ext', 'ext')
  copyIfEmpty('ContentType', 'ContentType', 'contentType', 'content_type')
  return out
}
