/**
 * 会话消息合并去重（打开会话 / HTTP / History 推送共用）
 * 键优先级：MsgRemoteId → MsgId → TaskId → 指纹；空键互不删除。
 */

import { isStrangerContactDigest } from '@/utils/conversationSort'
import { friendAddGreetingFromChat } from '@/utils/conversationDigest'
import { pickChatField, normalizeChatFields } from '@/utils/chatMessageFields'
import { logMsgFieldAnomaly, snapshotMsgFields, isMsgFieldDebugEnabled, logMsgFieldDebug } from '@/utils/msgFieldDebug'
import { STRANGER_TIP_MSG_ID_PREFIX } from '@/utils/openSessionHistory'

export const FINGERPRINT_WINDOW_MS = 5000
export const REVOKE_NOTICE_SVR_SUFFIX = '#revoke'

function isLocalStrangerTip(chat) {
  if (!chat) return false
  if (chat._strangerTip) return true
  const id = chat.MsgId != null ? String(chat.MsgId) : ''
  return id.startsWith(STRANGER_TIP_MSG_ID_PREFIX)
}

/**
 * @param {object|null|undefined} chat
 * @returns {boolean}
 */
export function isRevokeSystemNotice(chat) {
  if (!chat) return false
  if (chat.IsRevokeNotice === true) return true
  const t = chat.ContentType
  const text = String(chat.Content || '')
  return (t === 'System' || t === 5) && /撤回/.test(text)
}

/**
 * @param {object|null|undefined} x
 * @returns {number}
 */
function chatTime(x) {
  const t = Number((x && (x.CreateTime || x.msg_time || x.MsgTime)) || 0)
  return Number.isFinite(t) ? t : 0
}

/**
 * @param {object|null|undefined} x
 * @returns {string}
 */
export function fingerprintKey(x) {
  if (!x) return ''
  const wx = x.WxId != null && x.WxId !== '' ? String(x.WxId) : ''
  const conv = x.ConvId != null && x.ConvId !== '' ? String(x.ConvId) : ''
  const ct = x.ContentType != null && x.ContentType !== '' ? String(x.ContentType) : ''
  const content = x.Content != null ? String(x.Content).slice(0, 80) : ''
  if (!wx || !conv || !ct || !content) return ''
  const bucket = Math.floor(chatTime(x) / FINGERPRINT_WINDOW_MS)
  return 'fp:' + wx + '|' + conv + '|' + ct + '|' + content + '|' + bucket
}

/**
 * @param {object|null|undefined} x
 * @returns {string}
 */
export function chatUniqKey(x) {
  if (!x) return ''
  const r = x.MsgRemoteId != null && x.MsgRemoteId !== '' ? String(x.MsgRemoteId) : ''
  if (r && r !== '0') {
    const suffix = isRevokeSystemNotice(x) ? REVOKE_NOTICE_SVR_SUFFIX : ''
    return 'r:' + r + suffix
  }
  const m = x.MsgId != null && x.MsgId !== '' ? String(x.MsgId) : ''
  if (m && m !== '0') return 'm:' + m
  const t = x.TaskId != null && x.TaskId !== '' ? String(x.TaskId) : ''
  if (t && t !== '0') return 't:' + t
  return fingerprintKey(x)
}

/**
 * @param {object} prev
 * @param {object} chat
 * @returns {object}
 */
export function mergeChatFields(prev, chat) {
  const merged = { ...prev, ...chat }
  const chatContent = pickChatField(chat, 'Content', 'content', 'PlainContent', 'plainContent')
  const prevContent = pickChatField(prev, 'Content', 'content', 'PlainContent', 'plainContent')
  // WS/HTTP 字段名不一致时，禁止空 Content 冲掉已有正文（发布后重连常见）
  merged.Content =
    chatContent != null && chatContent !== '' ? chatContent : prevContent != null ? prevContent : ''
  const chatType = pickChatField(chat, 'ContentType', 'contentType', 'content_type')
  const prevType = pickChatField(prev, 'ContentType', 'contentType', 'content_type')
  if (chatType != null && chatType !== '') {
    merged.ContentType = chatType
  } else if (prevType != null && prevType !== '') {
    merged.ContentType = prevType
  }
  const chatUrl = pickChatField(chat, 'Url', 'url')
  const prevUrl = pickChatField(prev, 'Url', 'url')
  if (chatUrl) merged.Url = chatUrl
  else if (prevUrl) merged.Url = prevUrl
  const chatExt = pickChatField(chat, 'Ext', 'ext')
  const prevExt = pickChatField(prev, 'Ext', 'ext')
  if (chatExt) merged.Ext = chatExt
  else if (prevExt) merged.Ext = prevExt
  const hasReceipt =
    (chat.MsgId != null && chat.MsgId !== '' && String(chat.MsgId) !== '0') ||
    (chat.MsgRemoteId != null && chat.MsgRemoteId !== '' && String(chat.MsgRemoteId) !== '0')
  if ((prev.LocalSend === true || prev.PendingSync === true) && hasReceipt) {
    delete merged.LocalSend
    delete merged.PendingSync
  }
  // HTTP 行通常无 Flag/Status：合并时保留 WS/本地的发送失败标记，避免红点被冲掉
  // protobuf JSON 可能是 flag（小写）
  const FLAG_SEND_FAIL = 0x10000
  const prevFlag = Number(prev.Flag != null ? prev.Flag : prev.flag) || 0
  const chatFlag = Number(chat.Flag != null ? chat.Flag : chat.flag) || 0
  if ((prevFlag & FLAG_SEND_FAIL) === FLAG_SEND_FAIL || (chatFlag & FLAG_SEND_FAIL) === FLAG_SEND_FAIL) {
    merged.Flag = prevFlag | chatFlag
    merged.Status = 5
  }
  const prevStatus = Number(prev.Status)
  const chatStatus = Number(chat.Status)
  const prevFail = prevStatus === 5 || prevStatus === 0x10
  const chatFail = chatStatus === 5 || chatStatus === 0x10
  if (prevFail && !chatFail && (Number(merged.Flag) & FLAG_SEND_FAIL) !== FLAG_SEND_FAIL) {
    const prevIsLocalOnlyFail =
      prevStatus === 5 && (prevFlag & FLAG_SEND_FAIL) !== FLAG_SEND_FAIL
    // 服务端实消息已到且无协议失败位：清掉 PC 误标的 Status=5，避免已发出仍显示红点
    if (prevIsLocalOnlyFail && hasReceipt) {
      delete merged.Status
      delete merged.SendFailReason
    } else {
      merged.Status = prev.Status
    }
  }
  if (isMsgFieldDebugEnabled()) {
    const hadType = pickChatField(prev, 'ContentType', 'contentType', 'content_type')
    const hadBody = pickChatField(prev, 'Content', 'content', 'PlainContent', 'plainContent')
    const out = normalizeChatFields(merged)
    const lostType = hadType && !pickChatField(out, 'ContentType', 'contentType', 'content_type')
    const lostBody = hadBody && !pickChatField(out, 'Content', 'content', 'PlainContent', 'plainContent')
    if (lostType || lostBody) {
      logMsgFieldDebug('merge.lost', {
        lostType,
        lostBody,
        prev: snapshotMsgFields(prev),
        chat: snapshotMsgFields(chat),
        out: snapshotMsgFields(out)
      })
    }
    logMsgFieldAnomaly('merge.out', out, { hadType: !!hadType, hadBody: !!hadBody })
    return out
  }
  return normalizeChatFields(merged)
}

/**
 * 撤回通知与原文同 MsgRemoteId 时拆成两条，避免合并覆盖。
 * @param {object} a
 * @param {object} b
 * @returns {{ original: object, notice: object }|null}
 */
export function splitRevokeNoticeCollision(a, b) {
  if (!a || !b) return null
  const notice = isRevokeSystemNotice(a) ? a : isRevokeSystemNotice(b) ? b : null
  const original = isRevokeSystemNotice(a) ? b : isRevokeSystemNotice(b) ? a : null
  if (!notice || !original) return null
  const rA = original.MsgRemoteId != null && original.MsgRemoteId !== '' ? String(original.MsgRemoteId) : ''
  const rB = notice.MsgRemoteId != null && notice.MsgRemoteId !== '' ? String(notice.MsgRemoteId) : ''
  if (!rA || rA !== rB) return null
  return {
    original: { ...original, isPreviousRevoked: true },
    notice
  }
}

/**
 * @param {Array} list
 * @param {object} chat
 * @returns {number}
 */
function findMergeIndex(list, chat) {
  if (!Array.isArray(list) || !chat) return -1
  const key = chatUniqKey(chat)
  if (key) {
    const idx = list.findIndex((item) => chatUniqKey(item) === key)
    if (idx >= 0) return idx
  }
  const taskId =
    chat.TaskId != null && chat.TaskId !== '' && String(chat.TaskId) !== '0'
      ? String(chat.TaskId)
      : ''
  if (taskId) {
    const idx = list.findIndex((item) => {
      const t =
        item.TaskId != null && item.TaskId !== '' && String(item.TaskId) !== '0'
          ? String(item.TaskId)
          : ''
      return t === taskId
    })
    if (idx >= 0) return idx
  }
  const fp = fingerprintKey(chat)
  if (fp) {
    const idx = list.findIndex((item) => fingerprintKey(item) === fp)
    if (idx >= 0) return idx
  }
  return -1
}

/**
 * cleanupDigestPreview 前置闸门：仅当本次插入可能改变 cleanup 结果时才全量清理。
 * 生产突发（60 条/秒群发）下普通消息占绝大多数，逐条全量 cleanup 是主线程尖峰来源之一。
 * @param {Array} list 已插入 doc 后的列表
 * @param {object} doc 本次插入的消息
 * @returns {boolean}
 */
function needsDigestCleanup(list, doc) {
  const ct = doc && doc.ContentType
  if (doc) {
    if (doc._digestPreview) return true
    if (isLocalStrangerTip(doc)) return true
    if (friendAddGreetingFromChat(doc)) return true
    if ((ct === 'System' || ct === 5) && isStrangerContactDigest(doc.Content)) return true
  }
  for (const c of list) {
    if (!c) continue
    if (c._digestPreview) return true
    if (isLocalStrangerTip(c)) return true
    if (friendAddGreetingFromChat(c)) return true
  }
  return false
}

/**
 * WS 实时单条消息快路径（UPDATE_CURRENT_CHATS_BY_TALK 专用）。
 *
 * 语义与 mergeDedupeAndSort(list, [doc]) 对齐，但跳过全表索引重建 + 双重排序：
 *   - 命中（uniqKey/TaskId/指纹）→ mergeChatFields 合并或撤回碰撞拆分（复用 insertChatSorted）
 *   - 未命中 → 二分插入，保持列表升序
 *   - cleanupDigestPreview 仅在 needsDigestCleanup 时执行
 *
 * 前置条件：list 已升序（store 所有写入路径均维持该不变量，见 chatMerge 各出口）。
 * 对齐 kelailaichatpc UPDATE_CURRENT_CHATS「勿再全表 dedupe+sort（会话长列表时主线程尖峰）」。
 *
 * @param {Array} list 当前消息（须升序）
 * @param {object} doc 新到消息（已 normalize）
 * @returns {Array} 新数组（未命中保留原有元素引用，虚拟列表/视图层缓存友好）
 */
export function appendIncomingChat(list, doc) {
  const next = insertChatSorted(list, doc)
  if (needsDigestCleanup(next, doc)) {
    return cleanupDigestPreview(next)
  }
  return next
}

/**
 * 按 CreateTime 升序插入；命中则合并（含撤回碰撞拆分）。
 * @param {Array} list
 * @param {object} chat
 * @returns {Array}
 */
export function insertChatSorted(list, chat) {
  const arr = Array.isArray(list) ? list.slice() : []
  if (!chat) return arr

  const idx = findMergeIndex(arr, chat)
  if (idx >= 0) {
    const prev = arr[idx]
    const split = splitRevokeNoticeCollision(prev, chat)
    if (split) {
      arr[idx] = split.original
      return insertChatSorted(arr, split.notice)
    }
    arr[idx] = mergeChatFields(prev, chat)
    return arr
  }

  const t = chatTime(chat)
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (chatTime(arr[mid]) <= t) lo = mid + 1
    else hi = mid
  }
  arr.splice(lo, 0, chat)
  return arr
}

/**
 * @param {Array} list
 * @returns {Array}
 */
function cleanupDigestPreview(list) {
  let out = Array.isArray(list) ? list : []
  const hasReal = out.some((c) => {
    if (!c || c._digestPreview || isLocalStrangerTip(c)) return false
    const id = c.MsgId != null ? String(c.MsgId) : ''
    if (id.startsWith('digest-preview:')) return false
    return !!(chatUniqKey(c) || (c.Content != null && c.Content !== ''))
  })
  if (hasReal && out.some((c) => c && c._digestPreview)) {
    out = out.filter((c) => !c || !c._digestPreview)
  }
  // 手机已有真实「还不是你的联系人」System 时，去掉本地注入 tip，避免重复
  const hasRealStrangerSystem = out.some((c) => {
    if (!c || isLocalStrangerTip(c)) return false
    const ct = c.ContentType
    if (ct !== 'System' && ct !== 5) return false
    return isStrangerContactDigest(c.Content)
  })
  if (hasRealStrangerSystem && out.some((c) => isLocalStrangerTip(c))) {
    out = out.filter((c) => !isLocalStrangerTip(c))
  }
  // 已加好友：去掉本地「还不是你的联系人」tip（ContactPush 常滞后）
  const hasFriendAdd = out.some((c) => !isLocalStrangerTip(c) && friendAddGreetingFromChat(c))
  if (hasFriendAdd && out.some((c) => isLocalStrangerTip(c))) {
    out = out.filter((c) => !isLocalStrangerTip(c))
  }
  // 加好友问候：History 重拉常带多条，全部隐藏（视图层亦过滤）
  out = out.filter((c) => !friendAddGreetingFromChat(c))
  return out
}

/**
 * 当前会话消息软封顶：History 洪水 / 连点合并时只保留尾部，避免 DOM+decode 堵死主线程。
 * 上滑加载更多仍可增长（由 LoadChatsByHttp page>1 路径控制）。
 */
export const CURRENT_CHATS_SOFT_CAP = 80

/**
 * @param {Array|null|undefined} messages
 * @param {number} [cap]
 * @returns {Array}
 */
export function capMessagesTail(messages, cap = CURRENT_CHATS_SOFT_CAP) {
  if (!Array.isArray(messages)) return []
  const n = Number(cap)
  if (!Number.isFinite(n) || n <= 0 || messages.length <= n) return messages
  return messages.slice(-n)
}

/**
 * 合并去重并按时间升序。incoming 为空时保留 oldList。
 *
 * 复杂度：O((m+n) log(m+n)) —— 用 Map 索引替代逐条全表扫描，
 * 避免消息累积到几千条时卡死主线程（旧实现是 O(n²)）。
 *
 * 合并/去重/撤回拆分语义与原逐条 insertChatSorted 完全一致：
 *   - 同 chatUniqKey → mergeChatFields 合并
 *   - 同 MsgRemoteId 的撤回通知 → splitRevokeNoticeCollision 拆成两条
 *   - 兜底 TaskId / 指纹键同样按 Map 查
 *
 * 实现要点：索引的 value 存「数组元素引用」而非下标，避免数组改写
 * 或撤回拆分导致下标失效；每次命中合并后，把旧元素从其索引键移除，
 * 再用合并结果的键重建该元素索引，保证后续查找一致。
 * @param {Array} oldList
 * @param {Array} incoming
 * @returns {Array}
 */
export function mergeDedupeAndSort(oldList, incoming) {
  const old = Array.isArray(oldList) ? oldList : []
  const inc = Array.isArray(incoming) ? incoming : []

  const result = []
  // 单一索引：key → 元素引用。命中合并后按引用定位并更新。
  const index = new Map()

  const taskKey = (chat) => {
    const t = chat.TaskId != null && chat.TaskId !== '' && String(chat.TaskId) !== '0'
      ? String(chat.TaskId) : ''
    return t ? 'task:' + t : ''
  }

  const allKeysOf = (chat) => {
    const keys = []
    const k = chatUniqKey(chat)
    if (k) keys.push(k)
    const tk = taskKey(chat)
    if (tk) keys.push(tk)
    const fp = fingerprintKey(chat)
    if (fp) keys.push(fp)
    return keys
  }

  const addToIndex = (chat) => {
    for (const k of allKeysOf(chat)) index.set(k, chat)
  }

  const removeFromIndex = (chat) => {
    for (const k of allKeysOf(chat)) {
      if (index.get(k) === chat) index.delete(k)
    }
  }

  // notice 项本身不再触发撤回拆分（避免链式拆分导致的潜在递归）
  const upsert = (chat, allowSplit = true) => {
    if (!chat) return
    // 查找顺序与原 findMergeIndex 一致：uniqKey → taskKey → 指纹
    let hit = null
    const uk = chatUniqKey(chat)
    if (uk && index.has(uk)) hit = index.get(uk)
    if (!hit) {
      const tk = taskKey(chat)
      if (tk && index.has(tk)) hit = index.get(tk)
    }
    if (!hit) {
      const fp = fingerprintKey(chat)
      if (fp && index.has(fp)) hit = index.get(fp)
    }

    if (!hit) {
      result.push(chat)
      addToIndex(chat)
      return
    }

    // 命中：撤回碰撞拆分，或字段合并
    if (allowSplit) {
      const split = splitRevokeNoticeCollision(hit, chat)
      if (split) {
        removeFromIndex(hit)
        result[result.indexOf(hit)] = split.original
        addToIndex(split.original)
        // notice 作为新增项重新插入，但禁止再次拆分（最多拆一次）
        upsert(split.notice, false)
        return
      }
    }
    removeFromIndex(hit)
    const merged = mergeChatFields(hit, chat)
    result[result.indexOf(hit)] = merged
    addToIndex(merged)
  }

  for (const chat of old) upsert(chat)
  for (const chat of inc) upsert(chat)

  return cleanupDigestPreview(result).sort((a, b) => chatTime(a) - chatTime(b))
}
