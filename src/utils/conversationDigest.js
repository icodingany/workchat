import { decodeMsgContent } from '@/utils/downloadFileDetail'

const FRIEND_ADD_GREETING_DIGEST_PREFIXES = ['你已添加了', '以上是打招呼的内容']

/** System 消息可能带 HTML 图标，匹配前先剥标签 */
export function plainDigestText(digest) {
  return String(digest)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isFriendAddGreetingDigest(digest) {
  if (digest == null || digest === '') return false
  const text = plainDigestText(digest)
  if (FRIEND_ADD_GREETING_DIGEST_PREFIXES.some((p) => text.startsWith(p))) return true
  // 企微英文 System：「XXX has added YYY, Start chatting!」
  if (/\bhas added\b/i.test(text)) return true
  if (/^you('ve| have) added\b/i.test(text)) return true
  return false
}

/** 从消息各字段收集可判定正文（含 base64 解码） */
function chatDigestCandidates(chat) {
  if (!chat || typeof chat !== 'object') return []
  const keys = ['Content', 'content', 'PlainContent', 'plainContent']
  const out = []
  for (const k of keys) {
    const v = chat[k]
    if (v == null || v === '') continue
    let s = String(v)
    const t = s.trim()
    if (
      t &&
      !t.startsWith('<') &&
      !t.startsWith('{') &&
      !t.startsWith('[') &&
      !/^https?:\/\//i.test(t)
    ) {
      try {
        const decoded = decodeMsgContent(s)
        if (decoded && typeof decoded === 'string' && decoded.trim()) s = decoded
      } catch (_) {
        /* ignore */
      }
    }
    out.push(s)
  }
  return out
}

/** 消息是否为加好友 System 问候（HTML / base64 / 多字段） */
export function friendAddGreetingFromChat(chat) {
  return chatDigestCandidates(chat).some((s) => isFriendAddGreetingDigest(s))
}

export function isRedPacketContentType(ct) {
  return ct === 'LuckyMoney' || ct === 11 || ct === 'Sys_LuckyMoney' || ct === 16
}

export function isTransferContentType(ct) {
  return ct === 'MoneyTrans' || ct === 12
}

export function buildPinnedDigest(message, digest, isAtMe) {
  if (!message) return null
  const msgSvrId =
    message.MsgRemoteId != null
      ? String(message.MsgRemoteId)
      : message.MsgSvrId != null
        ? String(message.MsgSvrId)
        : ''
  if (isRedPacketContentType(message.ContentType)) {
    return { PinnedDigest: '[红包]', PinnedKind: 'redpacket', PinnedMsgSvrId: msgSvrId }
  }
  if (isTransferContentType(message.ContentType)) {
    return { PinnedDigest: '[转账]', PinnedKind: 'transfer', PinnedMsgSvrId: msgSvrId }
  }
  if (isAtMe) {
    return { PinnedDigest: digest || '[有人@你]', PinnedKind: 'atme', PinnedMsgSvrId: msgSvrId }
  }
  const text = digest != null ? String(digest) : ''
  if (text.includes('[转账]')) {
    return { PinnedDigest: '[转账]', PinnedKind: 'transfer', PinnedMsgSvrId: msgSvrId }
  }
  if (text.includes('[红包]')) {
    return { PinnedDigest: '[红包]', PinnedKind: 'redpacket', PinnedMsgSvrId: msgSvrId }
  }
  return null
}

export function isConversationDigestPinned(conv) {
  return !!(conv && conv.PinnedKind)
}

export function shouldShowConversationUnreadBadge(conv) {
  if (!conv) return false
  const silent =
    conv.Notified === false || conv.IsSilent === true || Number(conv.IsSilent) === 1
  if (silent) return false
  return (Number(conv.UnreadCnt) || 0) > 0
}

/**
 * 合并置顶标志。
 * proto3 省略 isTop=false；陈旧 ConversationPush 缺字段时不得冲掉本地乐观置顶。
 * 手机帧显式带 isTop/IsTop 时以手机为准。
 * @param {object|null|undefined} incoming
 * @param {object|null|undefined} existing
 * @returns {boolean}
 */
export function mergeConversationTopFlag(incoming, existing) {
  const hasField =
    incoming != null &&
    (Object.prototype.hasOwnProperty.call(incoming, 'isTop') ||
      Object.prototype.hasOwnProperty.call(incoming, 'IsTop'))
  if (!hasField) {
    return !!(existing && (existing.isTop || existing.IsTop || Number(existing.IsTop) > 0))
  }
  const raw = incoming.isTop != null ? incoming.isTop : incoming.IsTop
  return !!raw || Number(raw) > 0
}

/** 归一 UpdateTime/CreateTime 到毫秒（企微多为秒级 Unix；ReadAt 已是 ms） */
export function normalizeConvTimeMs(t) {
  if (t === null || t === undefined || t === '') return 0
  let n = Number(t)
  if (!Number.isFinite(n)) {
    const parsed = Date.parse(t)
    n = Number.isFinite(parsed) ? parsed : 0
  }
  if (n > 0 && n < 1e12) n *= 1000
  return n
}

/** 已读/回复后容忍手机 ConversationPush 滞后的宽限（毫秒） */
const UNREAD_SYNC_GRACE_MS = 30_000

/**
 * 合并手机/快照帧与本地 UnreadCnt。
 * proto3 省略 UnreadCnt=0 时不得抹掉本地累加；本地已读（ReadAt）后同 UpdateTime 的陈旧帧不得复活角标。
 */
export function mergeConversationUnreadCnt(incoming, existing) {
  const localVal = existing ? Number(existing.UnreadCnt) || 0 : 0
  const hasField =
    incoming != null &&
    (Object.prototype.hasOwnProperty.call(incoming, 'UnreadCnt') ||
      Object.prototype.hasOwnProperty.call(incoming, 'unreadCnt'))
  if (!hasField) return localVal

  const raw = incoming.UnreadCnt != null ? incoming.UnreadCnt : incoming.unreadCnt
  const incomingVal = Number(raw) || 0
  const incomingTimeMs = normalizeConvTimeMs(incoming.UpdateTime)
  const localTimeMs = existing ? normalizeConvTimeMs(existing.UpdateTime) : 0
  const readAtMs = existing ? normalizeConvTimeMs(existing.ReadAt) : 0
  const bumpAtMs = existing ? normalizeConvTimeMs(existing.UnreadBumpAt) : 0

  if (incomingVal > 0) {
    if (localVal === 0) {
      if (incomingTimeMs < localTimeMs) return 0
      // 已读/已回复后：宽限期内手机滞后 UnreadCnt 不得复活（秒级 UpdateTime vs ms ReadAt）
      if (readAtMs > 0 && incomingTimeMs <= readAtMs + UNREAD_SYNC_GRACE_MS) return 0
      if (readAtMs > 0 && incomingTimeMs <= localTimeMs) return 0
      return incomingVal
    }
    if (incomingTimeMs <= localTimeMs && incomingVal > localVal) return localVal
    return incomingVal
  }

  if (localVal === 0) return 0
  // FriendTalk 刚累加未读后，手机 ConversationPush 常带更新摘要但 UnreadCnt 仍为 0，不得抹角标
  if (
    incomingVal === 0 &&
    readAtMs === 0 &&
    bumpAtMs > 0 &&
    bumpAtMs >= localTimeMs &&
    incomingTimeMs >= bumpAtMs
  ) {
    return localVal
  }
  if (incomingTimeMs > localTimeMs) return 0
  return localVal
}

export function detectAtMeInGroupTalk(talk, myName) {
  if (!talk || !myName) return false
  if (!(talk.Members || Number(talk.Type) === 1)) return false
  let text = String(talk.Content || '')
  if (talk.PlainContent) text = String(talk.PlainContent)
  const name = String(myName)
  return text.includes('@' + name) || text.includes('@' + name + ' ')
}

export function clearAtMePinFields(conv) {
  if (!conv || conv.PinnedKind !== 'atme') return conv
  const next = { ...conv, AtCount: 0 }
  delete next.PinnedDigest
  delete next.PinnedKind
  delete next.PinnedMsgSvrId
  return next
}
