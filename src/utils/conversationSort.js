/**
 * 会话列表排序（对齐 kelailaichatpc conversationSort）
 * 档位：置顶 > 普通按时间 > 非好友/单向沉底；未读只展示角标
 */

import { normalizeId } from '@/utils/wechat'
import { isFriendAddGreetingDigest } from '@/utils/conversationDigest'

/** JS 不能写 1<<50，会截成 32 位 */
export const SORT_PRIORITY_STEP = 2 ** 50
export const SORT_PRIORITY_UNREAD = 0
export const SORT_PRIORITY_TOP = SORT_PRIORITY_STEP * 2
/** 非好友沉底惩罚：保证 time - SINK 低于一切「仅时间」会话 */
export const ONE_WAY_SINK_WEIGHT = SORT_PRIORITY_STEP
/** 外部联系人沉底惩罚：轻于陌生人，但重于好友 */
export const EXTERNAL_SINK_WEIGHT = SORT_PRIORITY_STEP / 2

/**
 * 企微非联系人会话摘要常为「xxx还不是你的联系人」，不当作真实预览。
 * @param {unknown} digest
 * @returns {boolean}
 */
export function isStrangerContactDigest(digest) {
  if (digest == null) return false
  return String(digest).includes('还不是你的联系')
}

/**
 * 挑选可用 Digest：跳过「还不是你的联系人」类提示，优先保留已有真实摘要。
 * @param {unknown} incoming
 * @param {unknown} [existing]
 * @returns {string}
 */
export function pickConversationDigest(incoming, existing) {
  const next = incoming != null ? String(incoming) : ''
  const prev = existing != null ? String(existing) : ''
  if (next && !isStrangerContactDigest(next)) return next
  if (prev && !isStrangerContactDigest(prev)) return prev
  return ''
}

/**
 * 是否群聊（企微会话）
 * @param {object|null|undefined} conv
 * @returns {boolean}
 */
export function isGroupConversation(conv) {
  if (!conv || typeof conv !== 'object') return false
  if (Number(conv.Type) === 1) return true
  const rid = normalizeId(conv.RemoteId ?? conv.remoteId)
  if (rid) {
    try {
      // eslint-disable-next-line no-undef
      if (Number(BigInt(rid) >> 48n) === 38) return true
    } catch (e) {
      /* ignore */
    }
  }
  if (Array.isArray(conv.Members) && conv.Members.length > 0) return true
  if (Array.isArray(conv.AvatarList) && conv.AvatarList.length > 0) return true
  return false
}

/**
 * 非好友/非联系人私聊（对齐 kelailaichatpc IsOneWay 沉底语义）
 * @param {object|null|undefined} conv
 * @param {object} [contactsMap] remoteId → 客户/企业联系人
 * @returns {boolean}
 */
export function isNonFriendConversation(conv, contactsMap) {
  if (!conv || typeof conv !== 'object') return false
  if (isGroupConversation(conv)) return false
  // 刚加好友摘要优先：ContactPush 滞后时不得当非好友
  if (isFriendAddGreetingDigest(conv.Digest)) return false
  if (isStrangerContactDigest(conv.Digest)) return true
  const rid = normalizeId(conv.RemoteId)
  if (!rid) return false
  if (!contactsMap || typeof contactsMap !== 'object') return true
  return !(contactsMap[rid] || contactsMap[conv.RemoteId])
}

/**
 * 会话联系状态: 'contact' | 'external' | 'stranger'
 * - contact: 企业联系人或客户（在 contactsMap 中）
 * - external: 聊过但不是联系人（会话存在且摘要不是"还不是联系人"）
 * - stranger: 从未联系过（摘要为"还不是你的联系人"）
 * @param {object|null|undefined} conv
 * @param {object} [contactsMap] remoteId → 客户/企业联系人
 * @returns {'contact'|'external'|'stranger'}
 */
export function getConversationContactStatus(conv, contactsMap) {
  if (!conv || typeof conv !== 'object') return 'stranger'
  if (isGroupConversation(conv)) return 'contact' // 群聊不标记

  const rid = normalizeId(conv.RemoteId)
  if (!rid) return 'stranger'

  // 检查是否是联系人
  if (contactsMap && typeof contactsMap === 'object') {
    if (contactsMap[rid] || contactsMap[conv.RemoteId]) {
      return 'contact'
    }
  }

  // 不在 contactsMap 中，检查摘要判断是否聊过
  // 如果摘要包含"还不是你的联系人"→ stranger；否则→ external（聊过但不是联系人）
  if (isStrangerContactDigest(conv.Digest)) {
    return 'stranger'
  }

  return 'external'
}

function isOneWayFlag(conv) {
  if (!conv || typeof conv !== 'object') return false
  const v = conv.IsOneWay != null ? conv.IsOneWay : conv.is_one_way
  return v === true || Number(v) === 1
}

/**
 * @param {object|null|undefined} conv 须已带 IsTop / UpdateTime / IsOneWay
 * @returns {number} 越大越靠前
 */
export function calculateSortScore(conv) {
  if (!conv || typeof conv !== 'object') return 0

  const isTop = !!(conv.isTop || conv.IsTop || Number(conv.IsTop) > 0)
  const topWeight = isTop ? SORT_PRIORITY_TOP : 0
  const timeWeight = Math.max(0, Number(conv.UpdateTime) || 0)
  let score = topWeight + timeWeight

  // 外部联系人：轻量沉底（比陌生人稍高）
  if (conv._isExternal && !isTop) {
    score -= EXTERNAL_SINK_WEIGHT
  }
  // 陌生人或 IsOneWay：深度沉底
  else if (isOneWayFlag(conv) && !isTop) {
    score -= ONE_WAY_SINK_WEIGHT
  }

  return score
}

/**
 * 排序条目缓存：conv 对象引用 → { contactsRef, freshKey, score, rid }。
 * 生产突发（60 条消息/秒）下每条消息触发一次侧栏重排；比较器若每次比较都做
 * 联系人状态判定 + 对象展开 + 分数计算，300 会话 × 60 次重排实测 1346ms（卡顿主因）。
 * 对齐 kelailaichatpc conversationSort「O(1) 比较，热路径不能每次重算」。
 * WeakMap 按 conv 引用缓存；UpdateConversations 只浅拷贝命中项，其余引用稳定可命中。
 * CHANGE_CONVERSATIONS 会原地改字段（不换引用），故用 freshKey 校验新鲜度。
 */
const _sortEntryCache = new WeakMap()

/** 新鲜度键：覆盖 score / rid 计算的全部输入字段 */
function conversationFreshKey(conv) {
  return `${conv.UpdateTime}|${conv.isTop}|${conv.IsTop}|${conv.IsOneWay}|${conv.is_one_way}|${
    conv.Digest
  }|${Array.isArray(conv.Members) ? conv.Members.length : 0}|${conv.RemoteId}`
}

function conversationSortEntry(conv, contactsMap) {
  if (!conv || typeof conv !== 'object') return { contactsRef: null, freshKey: '', score: 0, rid: '' }
  const freshKey = conversationFreshKey(conv)
  let entry = _sortEntryCache.get(conv)
  if (entry && entry.contactsRef === contactsMap && entry.freshKey === freshKey) return entry
  const status = getConversationContactStatus(conv, contactsMap)
  entry = {
    contactsRef: contactsMap,
    freshKey,
    score: calculateSortScore({
      ...conv,
      IsOneWay: status === 'external' || status === 'stranger' ? 1 : 0,
      _isExternal: status === 'external'
    }),
    rid: String(normalizeId(conv && conv.RemoteId))
  }
  _sortEntryCache.set(conv, entry)
  return entry
}

/**
 * @param {Array} convs
 * @param {object} [contactsMap]
 * @returns {Array}
 */
export function sortConversationsForDisplay(convs, contactsMap) {
  const list = Array.isArray(convs) ? [...convs] : []
  return list.sort((a, b) => {
    const ea = conversationSortEntry(a, contactsMap)
    const eb = conversationSortEntry(b, contactsMap)
    if (eb.score !== ea.score) return eb.score - ea.score
    return ea.rid.localeCompare(eb.rid)
  })
}
