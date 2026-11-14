/**
 * 消息 ContentType/Content 链路调试（生产临时定位用）
 *
 * 开启：控制台执行 localStorage.setItem('workchat.msgFieldDebug', '1') 后刷新
 * 关闭：localStorage.removeItem('workchat.msgFieldDebug')
 * 过滤：Console 搜 [msg-field-debug]
 */

const LS_KEY = 'workchat.msgFieldDebug'
const MAX_PER_STAGE = 30
const _counts = Object.create(null)

function readFlag() {
  try {
    if (typeof window !== 'undefined') {
      if (window.__WORKCHAT_MSG_FIELD_DEBUG__ === true) return true
      if (localStorage.getItem(LS_KEY) === '1') return true
      const q = window.location && window.location.search
      if (q && /(?:^|[?&])msgFieldDebug=1(?:&|$)/.test(q)) return true
    }
  } catch (_) {
    /* ignore */
  }
  return false
}

/** @returns {boolean} */
export function isMsgFieldDebugEnabled() {
  return readFlag()
}

function trunc(v, max = 120) {
  if (v == null) return v
  const s = typeof v === 'string' ? v : String(v)
  return s.length > max ? `${s.slice(0, max)}…(${s.length})` : s
}

/**
 * 消息对象上类型/正文字段快照（不打印全文）
 * @param {object|null|undefined} chat
 */
export function snapshotMsgFields(chat) {
  if (!chat || typeof chat !== 'object') return { chat: chat }
  const pick = (...keys) => {
    for (const k of keys) {
      const v = chat[k]
      if (v !== undefined && v !== null && v !== '') return v
    }
    return undefined
  }
  const content = pick('Content', 'content', 'PlainContent', 'plainContent')
  return {
    MsgRemoteId: pick('MsgRemoteId', 'msgRemoteId', 'msgSvrId', 'MsgSvrId'),
    MsgId: pick('MsgId', 'msgId'),
    TaskId: pick('TaskId', 'taskId'),
    ContentType: pick('ContentType', 'contentType', 'content_type'),
    contentType_raw: chat.contentType,
    ContentType_raw: chat.ContentType,
    Content: trunc(content),
    content_len: typeof content === 'string' ? content.length : 0,
    keys: Object.keys(chat).slice(0, 40)
  }
}

/**
 * @param {string} stage
 * @param {object} detail
 */
export function logMsgFieldDebug(stage, detail = {}) {
  if (!readFlag()) return
  const n = (_counts[stage] || 0) + 1
  _counts[stage] = n
  if (n > MAX_PER_STAGE) {
    if (n === MAX_PER_STAGE + 1) {
      console.warn('[msg-field-debug] 已达阶段日志上限，后续同阶段不再输出', stage)
    }
    return
  }
  console.warn(`[msg-field-debug][${stage}]`, detail)
}

/**
 * 缺类型且缺正文时打日志
 * @param {string} stage
 * @param {object|null|undefined} chat
 * @param {object} [extra]
 */
export function logMsgFieldAnomaly(stage, chat, extra = {}) {
  if (!readFlag()) return
  const snap = snapshotMsgFields(chat)
  const missingType =
    snap.ContentType === undefined || snap.ContentType === null || snap.ContentType === ''
  const missingBody = !snap.Content && snap.content_len === 0
  if (!missingType && !missingBody) return
  logMsgFieldDebug(stage, { ...extra, snap })
}
