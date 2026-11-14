/**
 * 本地发送失败重发：把「本地占位 Content」还原为手机端可下载的协议正文。
 *
 * TalkToFriendTask 本地预览对 Picture/Video 会把纯 URL 钉成 JSON（Thumb/url），
 * 若重发时原样下发，手机 SyncDownload 会把整段 JSON 当 URL → download failed。
 */

function isPictureType(ct) {
  return ct === 'Picture' || ct === 2 || ct === '2'
}

function isVideoType(ct) {
  return ct === 'Video' || ct === 4 || ct === '4'
}

/**
 * @param {string|number} contentType
 * @param {string} decoded Content（已 decodeMsgContent）
 * @returns {string}
 */
export function resolveOutgoingResendContent(contentType, decoded) {
  const raw = decoded == null ? '' : typeof decoded === 'string' ? decoded : String(decoded)
  const trimmed = raw.trim()
  if (!trimmed || !trimmed.startsWith('{')) return raw

  if (!isPictureType(contentType) && !isVideoType(contentType)) return raw

  try {
    const obj = JSON.parse(trimmed)
    if (!obj || typeof obj !== 'object') return raw
    const url =
      (typeof obj.url === 'string' && obj.url.trim()) ||
      (typeof obj.Url === 'string' && obj.Url.trim()) ||
      (typeof obj.midUrl === 'string' && obj.midUrl.trim()) ||
      (typeof obj.Thumb === 'string' && obj.Thumb.trim()) ||
      (typeof obj.thumbUrl === 'string' && obj.thumbUrl.trim()) ||
      ''
    if (url && /^https?:\/\//i.test(url)) return url
  } catch (_) {
    /* keep raw */
  }
  return raw
}
