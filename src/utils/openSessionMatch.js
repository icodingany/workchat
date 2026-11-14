/**
 * 打开会话归属校验（对齐 kelailaichatpc matchesCurrentChatSession）
 * workchat 会话键：WxId + RemoteId；兼容联系人 Id / 会话 Id 别名。
 */
import { normalizeId, normalizeWxId, sameId, sameWxId } from '@/utils/wechat'

/**
 * @param {object} getters conversation module getters（需含 currentWeChatId / currentFriendId / currentFriend）
 * @param {string|number} wxIdRaw
 * @param {string|number} convIdRaw
 * @returns {boolean}
 */
export function matchesCurrentChatSession(getters, wxIdRaw, convIdRaw) {
  const w = normalizeWxId(wxIdRaw)
  const c = normalizeId(convIdRaw)
  if (!w || !c) return false
  if (!sameWxId(w, getters && getters.currentWeChatId)) return false

  const candidates = new Set()
  const add = (v) => {
    const n = normalizeId(v)
    if (n) candidates.add(n)
  }
  add(getters && getters.currentFriendId)
  const friend = (getters && getters.currentFriend) || {}
  add(friend.RemoteId)
  add(friend.Id)
  add(friend.ConvId)
  return candidates.has(c)
}

/**
 * 当前对话框消息是否都属于目标会话（空列表视为可写）
 * @param {object} currentChats
 * @param {string|number} wxId
 * @param {string|number} convId
 */
export function currentChatsBelongToSession(currentChats, wxId, convId) {
  const msgs = (currentChats && currentChats.Messages) || []
  if (!msgs.length) {
    if (!currentChats) return true
    const emptyWx = !normalizeWxId(currentChats.WxId)
    const emptyConv = !normalizeId(currentChats.ConvId)
    if (emptyWx && emptyConv) return true
    return (
      sameWxId(currentChats.WxId, wxId) && sameId(currentChats.ConvId, convId)
    )
  }
  return sameWxId(currentChats.WxId, wxId) && sameId(currentChats.ConvId, convId)
}
