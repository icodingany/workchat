/**
 * 打开会话：是否需要手机拉历史 / Digest 是否领先（纯函数，便于单测）
 */
import {
  isStrangerContactDigest,
  isNonFriendConversation
} from '@/utils/conversationSort'
import { isFriendAddGreetingDigest } from '@/utils/conversationDigest'

/** 空库轮询间隔 */
export const OPEN_SESSION_POLL_INTERVAL_MS = 1000
/** 空库轮询最长等待 */
export const OPEN_SESSION_POLL_MAX_MS = 20000

/** 本地非好友提示 MsgId 前缀（与真实历史去重） */
export const STRANGER_TIP_MSG_ID_PREFIX = 'stranger-tip:'

/**
 * 会话摘要是否比当前已加载消息「更新」（侧栏有内容、中间偏旧/空）
 * 以时间为准；陌生人 Digest 不算。时间统一到秒再比，避免 ms/s 混用误判。
 * @param {object|null|undefined} conv
 * @param {Array} messages
 * @returns {boolean}
 */
export function isDigestAheadOfMessages(conv, messages) {
  if (!conv) return false
  const digest = conv.Digest != null ? String(conv.Digest) : ''
  if (!digest || isStrangerContactDigest(digest)) return false
  const msgs = Array.isArray(messages) ? messages : []
  if (!msgs.length) return true
  const last = msgs[msgs.length - 1]
  const msgSec = toUnixSeconds(last.CreateTime || last.msg_time || last.MsgTime)
  const convSec = toUnixSeconds(conv.CreateTime || conv.UpdateTime)
  if (convSec > 0 && msgSec > 0 && convSec > msgSec + 2) return true
  return false
}

/** @param {unknown} t @returns {number} */
function toUnixSeconds(t) {
  if (t === null || t === undefined || t === '') return 0
  let n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n > 1e12) n = Math.floor(n / 1000)
  return Math.floor(n)
}

/**
 * 打开会话后是否应 TriggerHistory + 轮询
 * 非好友 Digest（「还不是你的联系人」）即使本地已有气泡也强制拉一次：
 * 企微失败消息常 remoteId=0，不拉历史则 PC 永远看不到红点。
 * 真·空会话（无消息且无有效 Digest）不拉——否则会无意义 TriggerHistory，
 * 连点时 HistoryMsgPushNotice + 轮询易堵死主线程。
 * @param {object|null|undefined} conv
 * @param {Array} messages
 * @returns {boolean}
 */
export function shouldTriggerPhoneHistorySync(conv, messages) {
  const msgs = Array.isArray(messages) ? messages : []
  const digest = conv && conv.Digest != null ? String(conv.Digest) : ''
  if (digest && isStrangerContactDigest(digest)) return true
  if (!msgs.length) {
    // 有真实侧栏摘要才值得拉手机；digest 空 = 库中本就无历史
    return !!(digest && !isStrangerContactDigest(digest))
  }
  return isDigestAheadOfMessages(conv, msgs)
}

/**
 * HTTP/手机均空时，用会话 Digest 生成一条临时预览（避免侧栏有摘要、中间永久空白）。
 * 真实 History/HTTP 到达后由 merge 覆盖或并存去重。
 * 陌生人 Digest 不走此路径，见 buildStrangerTipChat。
 * @param {object} conv
 * @param {string|number} wxId
 * @param {string|number} convId
 * @returns {object|null}
 */
export function buildDigestPreviewChat(conv, wxId, convId) {
  if (!conv) return null
  const digest = conv.Digest != null ? String(conv.Digest) : ''
  if (!digest || isStrangerContactDigest(digest)) return null
  const t = toUnixSeconds(conv.UpdateTime || conv.CreateTime) || Math.floor(Date.now() / 1000)
  return {
    WxId: String(wxId || ''),
    ConvId: String(convId || ''),
    ContentType: 'Text',
    Content: digest,
    CreateTime: t,
    MsgTime: t,
    MsgId: 'digest-preview:' + String(convId || ''),
    MsgRemoteId: '',
    SenderId: '',
    SenderName: '',
    _digestPreview: true
  }
}

/**
 * 消息中是否已有「你已添加了 / 以上是打招呼的内容」等加好友证据。
 * 通讯录 ContactPush 常滞后，以此为准避免误注「还不是你的联系人」。
 * @param {Array} messages
 * @returns {boolean}
 */
export function messagesHaveFriendAddEvidence(messages) {
  const msgs = Array.isArray(messages) ? messages : []
  for (const m of msgs) {
    if (!m) continue
    const content = m.Content != null ? String(m.Content) : ''
    if (!content) continue
    if (isFriendAddGreetingDigest(content)) return true
  }
  return false
}

/**
 * 非好友/非联系人会话提示文案：优先 Digest，否则用昵称拼企微同款句式。
 * @param {object|null|undefined} conv
 * @param {object} [contactsMap]
 * @returns {string}
 */
export function resolveStrangerTipText(conv, contactsMap) {
  if (!conv || typeof conv !== 'object') return ''
  const digest = conv.Digest != null ? String(conv.Digest) : ''
  if (isFriendAddGreetingDigest(digest)) return ''
  if (isStrangerContactDigest(digest)) return digest
  if (!isNonFriendConversation(conv, contactsMap)) return ''
  const name =
    (conv.Name && String(conv.Name).trim()) ||
    (conv.Remark && String(conv.Remark).trim()) ||
    (conv.NickName && String(conv.NickName).trim()) ||
    '对方'
  return `${name}还不是你的联系人`
}

/**
 * 本地 System 气泡：企微常只有会话 Digest、历史无同文案 System，中间区需补一条。
 * @param {object} conv
 * @param {string|number} wxId
 * @param {string|number} convId
 * @param {object} [contactsMap]
 * @param {Array} [messages] 已有消息时把 tip 排到最早消息之前
 * @returns {object|null}
 */
export function buildStrangerTipChat(conv, wxId, convId, contactsMap, messages) {
  const msgs = Array.isArray(messages) ? messages : []
  // 刚加好友：历史已有加好友系统句，即使 contactsMap 未同步也不注入 tip
  if (messagesHaveFriendAddEvidence(msgs)) return null
  const text = resolveStrangerTipText(conv, contactsMap)
  if (!text) return null
  let t = toUnixSeconds(conv && (conv.UpdateTime || conv.CreateTime))
  if (msgs.length) {
    let minT = Infinity
    for (const m of msgs) {
      const mt = toUnixSeconds(m && (m.CreateTime || m.msg_time || m.MsgTime))
      if (mt > 0 && mt < minT) minT = mt
    }
    if (minT !== Infinity) t = Math.max(1, minT - 1)
  }
  if (!t) t = Math.floor(Date.now() / 1000)
  return {
    WxId: String(wxId || ''),
    ConvId: String(convId || ''),
    ContentType: 'System',
    Content: text,
    CreateTime: t,
    MsgTime: t,
    MsgId: STRANGER_TIP_MSG_ID_PREFIX + String(convId || ''),
    MsgRemoteId: '',
    SenderId: '',
    SenderName: '',
    _strangerTip: true
  }
}

/**
 * 当前消息列表是否已有非好友 tip（本地注入或真实 System）。
 * @param {Array} messages
 * @param {string} [tipText]
 * @returns {boolean}
 */
export function messagesHaveStrangerTip(messages, tipText) {
  const msgs = Array.isArray(messages) ? messages : []
  const tip = tipText != null ? String(tipText) : ''
  for (const m of msgs) {
    if (!m) continue
    if (m._strangerTip) return true
    const id = m.MsgId != null ? String(m.MsgId) : ''
    if (id.startsWith(STRANGER_TIP_MSG_ID_PREFIX)) return true
    const ct = m.ContentType
    const content = m.Content != null ? String(m.Content) : ''
    if ((ct === 'System' || ct === 5) && (isStrangerContactDigest(content) || (tip && content === tip))) {
      return true
    }
  }
  return false
}
