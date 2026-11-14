/**
 * 会话消息字段归一：HTTP snake/camel、WS PascalCase、IndexedDB 混存时统一字段。
 */
import { looksLikeEmojiPayload } from '@/utils/emojiPayload'
import { decodeMsgContent } from '@/utils/downloadFileDetail'
import { isFriendAddGreetingDigest, plainDigestText } from '@/utils/conversationDigest'
import { normalizeWxId, normalizeId } from '@/utils/wechat'
import { isMsgFieldDebugEnabled, logMsgFieldAnomaly } from '@/utils/msgFieldDebug'

/** 对齐 WTransport.proto EnumContentType */
const CONTENT_TYPE_NAME = {
  0: 'UnknownContent',
  1: 'Text',
  2: 'Picture',
  3: 'Voice',
  4: 'Video',
  5: 'System',
  6: 'Link',
  7: 'LinkExt',
  8: 'File',
  9: 'NameCard',
  10: 'Location',
  11: 'LuckyMoney',
  12: 'MoneyTrans',
  13: 'WeApp',
  14: 'Emoji',
  15: 'RoomManage',
  16: 'Sys_LuckyMoney',
  17: 'RoomSystem',
  18: 'BizLink',
  19: 'AudioCall',
  20: 'VideoCall',
  21: 'NotifyMsg',
  22: 'QuoteMsg',
  23: 'ForwardMsg',
  24: 'SnsNotify',
  25: 'ShiPinHao',
  26: 'AppFunCard',
  27: 'RoomLiving',
  28: 'FinderLive',
  29: 'KefuNameCard',
  30: 'QiyeNameCard',
  99: 'UnSupport'
}

const MEDIA_TYPES = new Set([
  'Picture', 2, '2',
  'Voice', 3, '3',
  'Video', 4, '4',
  'File', 8, '8'
])

/**
 * @param {string|number|null|undefined} type
 * @returns {string|number|null|undefined}
 */
export function normalizeContentType(type) {
  if (type === null || type === undefined || type === '') return type
  if (typeof type === 'number') return CONTENT_TYPE_NAME[type] || type
  if (typeof type === 'string' && /^\d+$/.test(type)) {
    const n = Number(type)
    return CONTENT_TYPE_NAME[n] || n
  }
  return type
}

/**
 * @param {object|null|undefined} chat
 * @param {...string} keys
 * @returns {*}
 */
export function pickChatField(chat, ...keys) {
  if (!chat || typeof chat !== 'object') return undefined
  for (const k of keys) {
    const v = chat[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

function isMediaContentType(ct) {
  return MEDIA_TYPES.has(ct) || MEDIA_TYPES.has(String(ct))
}

/**
 * ContentType 是否匹配（数字 / 字符串枚举名均可，内部 normalize）。
 * @param {string|number|null|undefined} ct
 * @param {...string|number} types
 * @returns {boolean}
 */
export function isContentType(ct, ...types) {
  if (ct === null || ct === undefined || ct === '') return false
  const normalized = normalizeContentType(ct)
  return types.some((type) => normalized === normalizeContentType(type))
}

function isEmptyWireContent(content) {
  return content == null || content === ''
}

/**
 * WS 瘦身或有效 MsgSvrId/MsgRemoteId：空 Content 的媒体仍可 DownloadFile 拉图。
 * 对齐 kelailaichatpc util-core.isResolvableEmptyMedia。
 * @param {object|null|undefined} chat
 * @returns {boolean}
 */
export function isResolvableEmptyMedia(chat) {
  if (!chat) return false
  if (chat.WsContentSlimmed === true || chat.wsContentSlimmed === true) return true
  const msgSvrId = pickChatField(chat, 'MsgSvrId', 'msgSvrId', 'msg_svr_id')
  if (msgSvrId != null && msgSvrId !== '') {
    const s = String(msgSvrId).trim()
    if (s !== '' && s !== '0') return true
  }
  const remote = pickChatField(chat, 'MsgRemoteId', 'msgRemoteId')
  if (remote != null && remote !== '') {
    const s = String(remote).trim()
    if (s !== '' && s !== '0') return true
  }
  return false
}

/**
 * WS 实时入库过滤（对齐 kelailaichatpc shouldFilterMessage）。
 * 仅丢弃：失败名片、无 MsgSvrId 的空媒体。文本/System 等一律保留。
 * @param {object|null|undefined} chat
 * @returns {boolean}
 */
export function shouldSkipEmptyIncomingChat(chat) {
  if (!chat) return true
  const ct = normalizeContentType(pickChatField(chat, 'ContentType', 'contentType', 'content_type'))
  const content = pickChatField(chat, 'Content', 'content')
  const status = pickChatField(chat, 'Status', 'status')

  const isNameCard = isContentType(ct, 'NameCard', 9)
  const isFail = status != null && String(status) === '5'
  if (isNameCard && isFail && isEmptyWireContent(content)) {
    return true
  }

  const isMedia =
    isContentType(ct, 'Picture', 2) ||
    isContentType(ct, 'Video', 4) ||
    isContentType(ct, 'Voice', 3) ||
    isContentType(ct, 'File', 8)
  if (isMedia && isEmptyWireContent(content)) {
    return !isResolvableEmptyMedia(chat)
  }

  return false
}

/**
 * 从正文 / JSON 推断 ContentType（WS Content 常为 base64，须先 decode）。
 * @param {string} content
 * @returns {string|null}
 */
export function inferContentTypeFromBody(content) {
  if (content == null || content === '') return null
  let s = String(content).trim()
  if (!s) return null
  if (!s.startsWith('{') && !s.startsWith('[') && !s.startsWith('<') && !/^https?:\/\//i.test(s)) {
    try {
      const decoded = decodeMsgContent(s)
      if (decoded && typeof decoded === 'string' && decoded.trim()) s = decoded.trim()
    } catch (_) {
      /* ignore */
    }
  }
  if (s.startsWith('<')) {
    const plain = plainDigestText(s)
    if (isFriendAddGreetingDigest(plain)) return 'System'
  }
  if (isFriendAddGreetingDigest(s)) return 'System'
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const j = JSON.parse(s)
      if (looksLikeEmojiPayload(j)) return 'Emoji'
      if (
        j &&
        (j.PaySubType != null || j.paySubType != null) &&
        (j.Feedesc != null || j.FeedDesc != null || j.feedesc != null)
      ) {
        return 'MoneyTrans'
      }
      if (j && (j.Key || j.key) && (j.Title != null || j.title != null || j.TotalNum != null)) {
        return 'LuckyMoney'
      }
      // 视频号 JSON 也有 url/thumb，须先于 Picture 判定
      if (
        j &&
        (j.nickname || j.Nickname || j.objectId || j.nonceId || j.NonceId) &&
        (j.cover || j.Cover || j.thumbUrl || j.Thumb || j.url || j.Url || j.mediaList || j.MediaList)
      ) {
        return 'ShiPinHao'
      }
      if (j && (j.url || j.Url || j.thumbUrl || j.ThumbUrl || j.Thumb || j.thumb || j.cdnUrl)) {
        return 'Picture'
      }
      if (j && (j.title || j.Title || j.desc || j.Des)) return 'Link'
      if (j && (j.text != null || j.quote)) return 'QuoteMsg'
    } catch (_) {
      /* ignore */
    }
  }
  if (/^https?:\/\//i.test(s)) return 'Picture'
  return 'Text'
}

/**
 * 解析可展示正文（多字段 + base64 解码）。
 * @param {object|null|undefined} chat
 * @returns {string}
 */
export function resolveChatContent(chat) {
  if (!chat || typeof chat !== 'object') return ''
  const raw = pickChatField(chat, 'Content', 'content', 'PlainContent', 'plainContent')
  if (raw != null && raw !== '') {
    if (typeof raw !== 'string') return String(raw)
    const trimmed = raw.trim()
    if (
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed.startsWith('<') ||
      /^https?:\/\//i.test(trimmed)
    ) {
      return raw
    }
    try {
      return decodeMsgContent(raw)
    } catch (_) {
      return raw
    }
  }
  return ''
}

/**
 * @param {object|null|undefined} chat
 * @returns {object|null|undefined}
 */
export function normalizeChatFields(chat) {
  if (!chat || typeof chat !== 'object') return chat

  const WxId = normalizeWxId(
    pickChatField(chat, 'WxId', 'wxId', 'WeChatId', 'weChatId', 'wechatId')
  )
  const ConvId = normalizeId(
    pickChatField(chat, 'ConvId', 'convId', 'FriendId', 'friendId', 'UserName', 'userName')
  )
  const MsgRemoteId = normalizeId(
    pickChatField(chat, 'MsgRemoteId', 'msgRemoteId', 'msgSvrId', 'MsgSvrId')
  )
  const MsgId = normalizeId(pickChatField(chat, 'MsgId', 'msgId'))
  const TaskId = normalizeId(pickChatField(chat, 'TaskId', 'taskId'))
  const SenderId = normalizeId(pickChatField(chat, 'SenderId', 'senderId'))
  const time = pickChatField(chat, 'CreateTime', 'createTime', 'msgTime', 'MsgTime')
  const rawType = pickChatField(chat, 'ContentType', 'contentType', 'content_type')
  const Content = resolveChatContent(chat)
  let ContentType = normalizeContentType(rawType)
  if (ContentType === null || ContentType === undefined || ContentType === '') {
    ContentType = inferContentTypeFromBody(Content) || (Content ? 'Text' : 'UnknownContent')
  }
  const Url = pickChatField(chat, 'Url', 'url')
  const Ext = pickChatField(chat, 'Ext', 'ext')
  const WsContentSlimmed =
    chat.WsContentSlimmed === true || chat.wsContentSlimmed === true || undefined

  const out = {
    ...chat,
    WxId,
    ConvId,
    MsgRemoteId,
    MsgId,
    SenderId,
    ContentType,
    Content
  }
  if (TaskId) out.TaskId = TaskId
  if (time != null && time !== '') {
    out.CreateTime = time
    out.MsgTime = time
  }
  if (Url) out.Url = Url
  if (Ext) out.Ext = Ext
  if (WsContentSlimmed) out.WsContentSlimmed = true
  if (isMsgFieldDebugEnabled()) {
    logMsgFieldAnomaly('normalize.out', out, { rawType, contentLen: Content ? Content.length : 0 })
  }
  return out
}
