/**
 * 转发 / 引用 / 合并门闸纯函数（供 ShowChats 与单测共用）
 */

/** 会话是否置顶 */
export function isConvTop(conv) {
  if (!conv) return false
  return !!(conv.isTop || conv.IsTop || Number(conv.IsTop) > 0)
}

/**
 * 转发「最近聊天」列表：排除置顶会话，可选排除当前会话
 * @param {Array} convs
 * @param {{ excludeRemoteId?: string|number }} [opts]
 */
export function buildForwardRecentConvs(convs, opts = {}) {
  const excludeRemoteId = opts.excludeRemoteId
  const list = Array.isArray(convs) ? convs : []
  return list.filter((c) => {
    if (!c || c.RemoteId == null || c.RemoteId === '') return false
    if (isConvTop(c)) return false
    if (excludeRemoteId != null && String(c.RemoteId) === String(excludeRemoteId)) return false
    return true
  })
}

/** 转发目标 RemoteId（企微） */
export function getForwardTargetId(row) {
  if (!row) return ''
  const id = row.RemoteId != null ? row.RemoteId : row.remoteId
  return id != null && id !== '' ? String(id) : ''
}

/** 从会话列表回查 LocalId，供手机端 forwardMsg 兜底 */
export function resolveForwardConvLocalId(convs, remoteId) {
  if (remoteId == null || remoteId === '') return 0
  const list = Array.isArray(convs) ? convs : []
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    if (String(c.RemoteId) === String(remoteId) && c.Id != null && c.Id !== '') {
      return c.Id
    }
  }
  return 0
}

export function createEmptyForwardSelectionByTab() {
  return { chat: [], friends: [], chatrooms: [] }
}

export function toggleForwardSelectionList(list, row) {
  const source = Array.isArray(list) ? list : []
  const id = getForwardTargetId(row)
  if (!id) return source.slice()
  const idx = source.findIndex((item) => getForwardTargetId(item) === id)
  if (idx >= 0) return source.filter((_, i) => i !== idx)
  return source.concat([row])
}

export function toggleForwardSelectionByTab(selectionByTab, tab, row) {
  const base = selectionByTab || createEmptyForwardSelectionByTab()
  const next = {
    chat: (base.chat || []).slice(),
    friends: (base.friends || []).slice(),
    chatrooms: (base.chatrooms || []).slice()
  }
  if (!Object.prototype.hasOwnProperty.call(next, tab)) return next
  next[tab] = toggleForwardSelectionList(next[tab], row)
  return next
}

export function resolveActiveForwardSelection(selectionByTab, activeTab) {
  const list = selectionByTab && selectionByTab[activeTab]
  return Array.isArray(list) ? list : []
}

export function resolveMsgRemoteId(chat) {
  if (!chat) return ''
  const id = chat.MsgRemoteId != null ? chat.MsgRemoteId : chat.msgSvrId
  return id != null && id !== '' ? String(id) : ''
}

export function canForwardChat(chat) {
  return !!resolveMsgRemoteId(chat)
}

export function buildForwardMultiPayload({ WxId, MsgIds, ConvIds, LocalIds, Merge, TaskId }) {
  return {
    WxId,
    MsgIds: (MsgIds || []).map(String),
    ConvIds: (ConvIds || []).map(String),
    LocalIds: (LocalIds || []).map(String),
    Merge: !!Merge,
    TaskId
  }
}

export function shouldShowMergeForward(supportsMergeForward, selectedCount) {
  return !!supportsMergeForward && selectedCount >= 2
}

export const QUOTE_TYPES = [
  'Text',
  1,
  'Picture',
  2,
  'Link',
  6,
  'File',
  8,
  'Video',
  4,
  'Emoji',
  14,
  'WeApp',
  13
]

export function canQuoteChat(chat) {
  if (!chat || !resolveMsgRemoteId(chat)) return false
  return QUOTE_TYPES.indexOf(chat.ContentType) >= 0
}
