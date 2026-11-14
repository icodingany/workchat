/**
 * 表情包（ContentType=14）展示/发送辅助，对齐 kelailaichatpc。
 */
import phiz from '@/utils/phiz.js'

export const EMOJI_PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSI0IiBmaWxsPSIjRThFOEU4Ii8+PHBhdGggZD0iTTI0IDIwaDE2djE2SDI0eiIgZmlsbD0iI0M2QzZDNiIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjgiIHI9IjQiIGZpbGw9IiM5RTlFOUUiLz48cGF0aCBkPSJNMjYgNDBoMTJ2MkgyNnoiIGZpbGw9IiM5RTlFOUUiLz48L3N2Zz4='

const WECHAT_CDN_HTTPS_PATTERN =
  /^https:\/\/([^/]*\.(tc\.qq\.com|qpic\.cn|wx\.qq\.com|weixin\.qq\.com)|vweixinf\.tc\.qq\.com)(\/|$)/i
const VWEIXINF_PATTERN = /vweixinf\.tc\.qq\.com/i

/** 骰子 / 猜拳文件名 → 固定 qpic */
const EMOJI_GAME_URL_MAP = {
  'jsb_j.png': 'http://emoji.qpic.cn/wx_emoji/abG5b87mcOW7YxBZFZPZOBXUjE99n48g6Znn6zaUiaVRtxMBYaEEKoA/',
  'jsb_s.png': 'http://emoji.qpic.cn/wx_emoji/ARQOAfC52Cu6iczyCvLhibUNQxCialTeaeObDoEMsL7uJjyV5dqzCNCFQ/',
  'jsb_b.png': 'http://emoji.qpic.cn/wx_emoji/Ty7jp6YeVib7MibicS8eb9buorVCg7mYTFXxuEpVDyQMaqK6PUoOcGxbQ/',
  'dice_1.png': 'http://emoji.qpic.cn/wx_emoji/QsDXJwBwXEXGFwLHJCm6haBlFls30vzPQcZTib9dyhLiazKxoPX6kp0A/',
  'dice_2.png':
    'http://emoji.qpic.cn/wx_emoji/YbCHM38dRYCIWbKmiaBrdnPrfuuwicLD2iacSWaPoAiaFrUySG87ELibOXQ/',
  'dice_3.png': 'http://emoji.qpic.cn/wx_emoji/lgVbvPFtzP8ytMiaKZMUoV3BXNPRfUaP69vozHfNarmX3MlTrgOhrkA/',
  'dice_4.png': 'http://emoji.qpic.cn/wx_emoji/zaBCJf5hVDn8NlibdrxV4NoPc12d28S7s67UCJqwynRmB0spdttIbeQ/',
  'dice_5.png': 'http://emoji.qpic.cn/wx_emoji/72IJJTdBzuibcxvnpFVicUAzCWRJC3cKhtkpMHTFejC2cyOeEGSHibTKw/',
  'dice_6.png': 'http://emoji.qpic.cn/wx_emoji/Jowow1icuI3XqtkFeQgIuzjIEYHdtJZictGFJjTsAFwW1g6cx1uTaQfw/'
}

function isPageHttps() {
  return typeof window !== 'undefined' && window.location && window.location.protocol === 'https:'
}

function getImageProxyBase() {
  const env = typeof process !== 'undefined' && process.env ? process.env.VUE_APP_IMAGE_PROXY_BASE : undefined
  if (env === '' || env === 'false' || env === '0') return null
  if (env && env.trim()) return env.trim()
  return 'https://wsrv.nl/?url='
}

function pickNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

/**
 * 微信/腾讯 CDN URL 归一：混合内容升级、vweixinf 走图片代理。
 * @param {string} url
 * @returns {string}
 */
export function toHttpForWechatCdn(url) {
  if (!url || typeof url !== 'string') return url
  let normalized = url.replace(/&amp;/gi, '&')
  if (VWEIXINF_PATTERN.test(normalized)) {
    const proxyBase = getImageProxyBase()
    if (proxyBase) {
      const isWsrv = proxyBase.startsWith('https://wsrv.nl/') || proxyBase.startsWith('https://wsrv.nl?')
      const suffix = isWsrv ? '&n=-1&output=gif' : ''
      return proxyBase + encodeURIComponent(normalized) + suffix
    }
  }
  if (isPageHttps() && /^http:\/\//i.test(normalized)) {
    return normalized.replace(/^http:\/\//i, 'https://')
  }
  if (!isPageHttps() && WECHAT_CDN_HTTPS_PATTERN.test(normalized)) {
    return normalized.replace(/^https:\/\//i, 'http://')
  }
  return normalized
}

/** 发送/预览用 CDN 地址（多字段兼容） */
export function getEmojiSendUrl(emoji) {
  if (!emoji || typeof emoji !== 'object') return ''
  return pickNonEmpty(
    emoji.cdnUrl,
    emoji.cdnurl,
    emoji.url,
    emoji.Url,
    emoji.Thumb,
    emoji.thumb,
    emoji.staticUrl,
    emoji.externUrl,
    emoji.encrypturl
  )
}

/** 气泡缩略图字段（含 staticUrl） */
export function getEmojiThumbUrl(emoji) {
  if (!emoji || typeof emoji !== 'object') return ''
  return pickNonEmpty(
    emoji.url,
    emoji.Url,
    emoji.cdnUrl,
    emoji.cdnurl,
    emoji.Thumb,
    emoji.thumb,
    emoji.staticUrl,
    emoji.externUrl,
    emoji.encrypturl
  )
}

/**
 * 历史/撤回常见：JSON 像表情但 ContentType 被标成 Text/System。
 * @param {Object} jContent
 * @returns {boolean}
 */
export function looksLikeEmojiPayload(jContent) {
  if (!jContent || typeof jContent !== 'object') return false
  // 与 kelailaichatpc 一致：不用裸 url（图片 JSON 也有 url+size，易误判）
  const hasThumb = !!(
    jContent.Thumb ||
    jContent.thumb ||
    jContent.cdnUrl ||
    jContent.cdnurl ||
    jContent.externUrl ||
    jContent.encrypturl
  )
  const hasMeta = !!(
    jContent.md5 ||
    jContent.Md5 ||
    jContent.MD5 ||
    jContent.aeskey ||
    jContent.AesKey ||
    jContent.aesKey ||
    jContent.groupId ||
    jContent.externMd5 ||
    jContent.Size != null ||
    jContent.size != null
  )
  return hasThumb && hasMeta
}

/**
 * 收藏表情发送前补齐手机端 EmojiMsgBean 兼容字段。
 * @param {Object} emoji
 * @param {string} cdnUrl
 * @returns {Object|null}
 */
export function normalizeEmojiPayloadForSend(emoji, cdnUrl) {
  if (!emoji || !cdnUrl) return null
  const md5 = pickNonEmpty(emoji.md5, emoji.Md5)
  const aeskey = pickNonEmpty(emoji.aeskey, emoji.AesKey, emoji.aesKey)
  const groupId = pickNonEmpty(emoji.groupId, emoji.productId)
  const externUrl = pickNonEmpty(emoji.externUrl, emoji.externurl)
  const encrypturl = pickNonEmpty(emoji.encrypturl, emoji.encryptUrl)
  const thumb = pickNonEmpty(emoji.Thumb, emoji.thumb, emoji.thumbUrl, cdnUrl)
  const url = pickNonEmpty(emoji.url, emoji.Url, cdnUrl, emoji.cdnUrl, emoji.cdnurl, externUrl)

  return {
    ...emoji,
    url,
    aesKey: aeskey || emoji.aesKey || '',
    md5: md5 || emoji.md5,
    groupId: groupId || emoji.groupId,
    staticUrl: pickNonEmpty(emoji.staticUrl, emoji.StaticUrl, thumb),
    thumbUrl: pickNonEmpty(emoji.thumbUrl, thumb),
    cdnUrl,
    cdnurl: pickNonEmpty(emoji.cdnurl, cdnUrl),
    Md5: pickNonEmpty(emoji.Md5, md5, emoji.md5),
    aeskey: aeskey || emoji.aeskey,
    AesKey: pickNonEmpty(emoji.AesKey, aeskey, emoji.aeskey),
    productId: pickNonEmpty(emoji.productId, groupId, emoji.groupId),
    externUrl: externUrl || emoji.externUrl,
    externurl: pickNonEmpty(emoji.externurl, externUrl, emoji.externUrl),
    encrypturl: encrypturl || emoji.encrypturl,
    Thumb: thumb
  }
}

export function getEmojiPreviewSrc(emoji) {
  const cdnUrl = getEmojiSendUrl(emoji)
  if (!cdnUrl) return EMOJI_PLACEHOLDER_DATA_URL
  try {
    return toHttpForWechatCdn(cdnUrl) || EMOJI_PLACEHOLDER_DATA_URL
  } catch (e) {
    return EMOJI_PLACEHOLDER_DATA_URL
  }
}

/**
 * 渲染表情气泡 HTML（客服端 / 管理端共用）。
 * @param {Object|null} jContent
 * @param {string} [content]
 * @returns {string}
 */
export function renderEmojiHtml(jContent, content) {
  const thumbRaw = getEmojiThumbUrl(jContent)
  const regJson = /^\s*\{[\s\S]*\}\s*$/
  const emojiRawForFallback =
    typeof content === 'string' && !regJson.test(content.trim())
      ? content.trim()
      : String((jContent && (jContent.Des || jContent.des || jContent.desc || jContent.Type)) || '').trim()
  const emojiFallbackLabel = phiz.emojiFallbackText(emojiRawForFallback)
  const emojiFallbackAlt = emojiFallbackLabel.replace(/"/g, '&quot;')
  if (thumbRaw) {
    const mapped = EMOJI_GAME_URL_MAP[thumbRaw]
    const imgUrl = toHttpForWechatCdn(mapped || thumbRaw)
    return `<img class="chat-emoji" style="width:100px;height:auto;max-width:100%;aspect-ratio:1/1;object-fit:contain;background:#f3f4f6" src="${imgUrl}" referrerpolicy="no-referrer" title="点击看大图" alt="${emojiFallbackAlt}" onerror="this.onerror=null;this.replaceWith(document.createTextNode(this.getAttribute('alt')||'[表情]'))"/>`
  }
  return emojiFallbackLabel
}
