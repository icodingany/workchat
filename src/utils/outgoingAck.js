/**
 * TalkToFriend 发消息回执统一处理（TalkToFriendTaskResultNotice / TaskResultNotice 共用）。
 */
import {
  hasOutgoingMessageReceipt,
  isExplicitTalkToFriendTaskResultFailure,
  isTalkToFriendTaskResultSuccess
} from '@/utils/localSendPreview'
import { clearTalkToFriendTaskTimeout } from '@/api/webSocketApi'

function hasOutgoingErrMsg(message = {}) {
  const err = message.ErrMsg ?? message.errMsg ?? message.Message ?? message.message
  return typeof err === 'string' && err.trim() !== ''
}

function isGroupCurrentFriend(store) {
  const friend = store.getters['conversation/currentFriend']
  return !!(friend && friend.Members && friend.Members.length)
}

/**
 * @param {import('vuex').Store} store
 * @param {object} message WS 回执 payload
 * @returns {'success'|'failed'|'ignored'}
 */
export function handleTalkToFriendTaskResult(store, message) {
  if (!message || !store) return 'ignored'

  if (isTalkToFriendTaskResultSuccess(message)) {
    store.dispatch('conversation/ApplyTalkResultToLocal', message)
    if (!hasOutgoingMessageReceipt(message) && !isGroupCurrentFriend(store)) {
      store.dispatch('conversation/ScheduleOutgoingAckFallback', message)
    }
    return 'success'
  }

  if (isExplicitTalkToFriendTaskResultFailure(message) || hasOutgoingErrMsg(message)) {
    store.dispatch('conversation/MarkLocalSendFailed', message)
    return 'failed'
  }

  return 'ignored'
}

/** FriendTalkNotice / TalkToFriendNotice 共用：更新会话列表 + 入库 */
export function ingestTalkNoticeToStore(store, message) {
  if (!message || !store) return
  store.dispatch('conversation/UpdateConversations', message)
  store.dispatch('conversation/AddChats', message)
}

/**
 * TalkToFriendNotice：合并真实消息，不先删本地预览（空 Notice 被 skip 时会丢气泡）。
 * @param {import('vuex').Store} store
 * @param {object} message
 */
export function handleTalkToFriendNotice(store, message) {
  if (!message || !store) return
  clearTalkToFriendTaskTimeout(message)
  ingestTalkNoticeToStore(store, message)
}

export { hasOutgoingErrMsg, hasOutgoingMessageReceipt as hasOutgoingReceipt }
