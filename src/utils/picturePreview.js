import base64 from '@/utils/base64'
import { toHttpForWechatCdn } from '@/utils/emojiPayload'

/** 企微/微信 CDN 展示 URL：https 升级、vweixinf 走代理 */
export function normalizePictureUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const normalized = toHttpForWechatCdn(url.replace(/&amp;/gi, '&'))
  return safeHttpUrl(normalized)
}

function isQiniuProcessUrl(url) {
  return /imageView2\//i.test(url) || /imageMogr2\//i.test(url) || /[?&]vframe\//i.test(url)
}

function isHostedDirectImageUrl(url) {
  return /file\.example\.invalid/i.test(url)
}

/** 去掉七牛 imageView2 / vframe 等处理参数，得到 CDN 原图直链 */
export function stripImageProcessParams(url) {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (!isQiniuProcessUrl(u)) return u
  const q = u.indexOf('?')
  return q >= 0 ? u.slice(0, q) : u
}

/** 展示 URL 是否已是可当作原图使用的直链（对齐 kelailaichatpc 简化版） */
export function isPictureDisplayUrlOriginal(chat, displayUrl, thumbUrl = '') {
  if (!displayUrl) return false
  const thumbNorm = normalizePictureUrl(thumbUrl || getPictureThumbUrl(chat))
  const displayNorm = normalizePictureUrl(displayUrl)
  if (!displayNorm) return false
  if (isQiniuProcessUrl(displayNorm)) return false
  if (thumbNorm && thumbNorm === displayNorm) return false
  if (isHostedDirectImageUrl(displayNorm) && thumbNorm && thumbNorm !== displayNorm) return true
  if (chat && chat._originalImageReady === true) return true
  if (thumbNorm && thumbNorm !== displayNorm) return true
  return false
}

/**
 * 从图片消息字段中解析"可点开大图"的 URL。
 * 原图优先，只有缩略图时也返回（保证点击能秒开，后台再升原图）。
 * @returns {{ url: string, isOriginal: boolean } | null}
 */
export function resolvePictureUrl(chat) {
  if (!chat) return null
  const j = chat.jContent
  let src = ''
  let isOriginal = false

  if (j) {
    src = normalizePictureUrl(j.url) || normalizePictureUrl(j.Url)
    if (src) {
      const stripped = stripImageProcessParams(src)
      if (stripped && stripped !== src && isHostedDirectImageUrl(stripped)) {
        return { url: stripped, isOriginal: true }
      }
      isOriginal = isPictureDisplayUrlOriginal(chat, src)
    } else {
      src =
        normalizePictureUrl(j.midUrl) ||
        normalizePictureUrl(j.thumbUrl) ||
        normalizePictureUrl(j.ThumbUrl) ||
        normalizePictureUrl(j.Thumb) ||
        normalizePictureUrl(j.thumb) ||
        normalizePictureUrl(j.cdnUrl) ||
        normalizePictureUrl(j.cdnurl)
      const stripped = stripImageProcessParams(src)
      if (stripped && stripped !== src && isHostedDirectImageUrl(stripped)) {
        return { url: stripped, isOriginal: true }
      }
      isOriginal = false
    }
    if (!src && j.Ext) {
      const ext = typeof j.Ext === 'string' ? j.Ext : ''
      src = normalizePictureUrl(ext)
      if (!src) {
        try {
          src = normalizePictureUrl(base64.decode(ext))
        } catch (e) {
          /* ignore */
        }
      }
      // Ext 字段语义就是原图直链（对齐历史协议）
      if (src) isOriginal = true
    }
  }
  if (!src && chat.Content) {
    src = normalizePictureUrl(chat.Content)
    // Content 为 http 直链：多为自发送或 HTTP 明文历史，可直接当原图
    if (src) isOriginal = true
  }
  if (!src) return null
  return { url: src, isOriginal }
}

/** 消息缩略图 URL（用于判断缓存原图是否只是缩略图） */
export function getPictureThumbUrl(chat) {
  if (!chat || !chat.jContent) return ''
  const j = chat.jContent
  return (
    normalizePictureUrl(j.thumbUrl) ||
    normalizePictureUrl(j.ThumbUrl) ||
    normalizePictureUrl(j.Thumb) ||
    normalizePictureUrl(j.thumb) ||
    normalizePictureUrl(j.midUrl) ||
    ''
  )
}

function pickMapUrl(bigImageMap, chat) {
  if (!bigImageMap || !chat) return ''
  const keys = [chat.MsgId, chat.MsgRemoteId, chat.MsgSvrId].filter(
    (k) => k != null && String(k).trim() !== ''
  )
  for (const k of keys) {
    const v = bigImageMap[k] ?? bigImageMap[String(k)]
    const url = normalizePictureUrl(typeof v === 'string' ? v.trim() : '')
    if (url) return url
  }
  return ''
}

/**
 * 大图预览 URL：bigImageMap 原图缓存优先，其次消息字段解析。
 * @param {object} chat
 * @param {Record<string, string>} [bigImageMap]
 * @returns {{ url: string, isOriginal: boolean }}
 */
export function resolvePicturePreviewUrl(chat, bigImageMap = {}) {
  if (!chat) return { url: '', isOriginal: false }
  if (chat._originalImageReady === true) {
    const cached = pickMapUrl(bigImageMap, chat)
    if (cached) return { url: cached, isOriginal: true }
  }
  const cached = pickMapUrl(bigImageMap, chat)
  const thumb = getPictureThumbUrl(chat)
  if (cached) {
    return {
      url: cached,
      isOriginal: isPictureDisplayUrlOriginal(chat, cached, thumb)
    }
  }
  const base = resolvePictureUrl(chat)
  if (!base) return { url: '', isOriginal: false }
  if (thumb && base.url === thumb) {
    return { url: base.url, isOriginal: false }
  }
  return base
}

/**
 * 图片消息的稳定 key：DownloadFileByMsgIdTask 用 MsgId 发起，
 * 回包（DownloadFileResultNotice）也按 MsgId 匹配，故以 MsgId 为准。
 */
export function pictureMsgKey(chat) {
  if (!chat) return ''
  if (chat.MsgId != null && String(chat.MsgId).trim()) return String(chat.MsgId)
  if (chat.MsgRemoteId != null && String(chat.MsgRemoteId).trim()) return String(chat.MsgRemoteId)
  if (chat.MsgSvrId != null && String(chat.MsgSvrId).trim()) return String(chat.MsgSvrId)
  return ''
}

export function safeHttpUrl(url) {
  return url && /^https?:\/\//i.test(url) ? url : ''
}
