/**
 * ShowChats 视图层消息预处理：normalize + jContent 解析 + friendAdd 去重。
 * 从 ShowChats.chats computed 抽出，供单测与组件共用。
 */
import { normalizeChatFields } from '@/utils/chatMessageFields'
import { friendAddGreetingFromChat } from '@/utils/conversationDigest'
import { isMsgFieldDebugEnabled, logMsgFieldAnomaly } from '@/utils/msgFieldDebug'

/**
 * 从 Content 解析 jContent（JSON 对象）。
 * @param {object} chat 已 normalize 的消息
 * @returns {object} 带 jContent 的副本
 */
export function attachJContent(chat) {
  const xi = { ...chat }
  if (typeof xi.Content !== 'string' || !xi.Content) return xi
  const t = xi.Content.trim()
  if (!t.startsWith('{') || !t.endsWith('}')) return xi
  try {
    xi.jContent = JSON.parse(t)
  } catch (_) {
    /* ignore */
  }
  return xi
}

/**
 * 已 normalize 的消息 → 视图项（jContent + debug）。
 * @param {object} base normalizeChatFields 结果
 * @returns {object}
 */
export function finalizeChatViewItem(base) {
  const xi = attachJContent(base)
  if (isMsgFieldDebugEnabled()) {
    logMsgFieldAnomaly('view.chats', xi, { finger: buildChatViewFinger(base) })
  }
  return xi
}

/**
 * 单条消息 → 视图可用形态（normalize + jContent）。
 * @param {object} raw
 * @returns {object}
 */
export function prepareChatViewItem(raw) {
  const base = normalizeChatFields(raw)
  return finalizeChatViewItem(base)
}

/**
 * 视图层缓存指纹（对齐 ShowChats.chats computed）。
 * @param {object} base normalizeChatFields 结果
 * @returns {string}
 */
export function buildChatViewFinger(base) {
  return `${base.MsgRemoteId || ''}|${base.MsgId || ''}|${base.TaskId || ''}|${base.ContentType}|${
    typeof base.Content === 'string' ? base.Content.length : 0
  }|${base.CreateTime || 0}|${base.Status || ''}|${base.isPreviousRevoked ? 1 : 0}`
}

/**
 * 视图层隐藏加好友 System 问候（企微英文 has added / 中文你已添加了等）。
 * @param {Array} messages
 * @returns {Array}
 */
export function filterFriendAddGreetings(messages) {
  return (messages || []).filter((x) => !friendAddGreetingFromChat(x))
}

/** @deprecated 名称保留兼容；行为为全部过滤，不再保留一条 */
export function filterDuplicateFriendAddGreetings(messages) {
  return filterFriendAddGreetings(messages)
}

/**
 * 无缓存版全量预处理（单测 / 非 ShowChats 场景）。
 * @param {Array} raw
 * @returns {Array}
 */
export function prepareChatsForView(raw) {
  const decoded = (raw || []).map((x) => prepareChatViewItem(x))
  return filterDuplicateFriendAddGreetings(decoded)
}
