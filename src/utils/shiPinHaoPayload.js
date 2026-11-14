/**
 * 视频号（ShiPinHao）收藏/发送：补齐手机 hook SphMsgBean 字段。
 * workchat proto：ShiPinHao = 25（与 kelailaichatpc 的 24 不同）。
 */

/** 取首个非空字符串（trim 后）。 */
function pickNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

/**
 * 视频号列表/预览封面 URL：优先 cover（真实封面），再回退 thumb。
 * 部分素材 mediaList[0].thumb 是近黑视频首帧，直接当封面会显示黑块/错帧。
 * 不回退 sph.url：聊天里 url 多为视频/feed 地址，作 img src 会黑块。
 * @param {Object|null|undefined} sph
 * @returns {string}
 */
export function pickSphCoverUrl(sph) {
  if (!sph || typeof sph !== 'object') return ''
  const mediaList = Array.isArray(sph.mediaList)
    ? sph.mediaList
    : Array.isArray(sph.MediaList)
      ? sph.MediaList
      : null
  const media0 =
    mediaList && mediaList.length > 0 && mediaList[0] && typeof mediaList[0] === 'object'
      ? mediaList[0]
      : null
  return pickNonEmpty(
    media0 && media0.cover,
    media0 && media0.Cover,
    media0 && media0.coverUrl,
    media0 && media0.CoverUrl,
    sph.cover,
    sph.Cover,
    sph.coverUrl,
    sph.CoverUrl,
    sph.thumbUrl,
    sph.ThumbUrl,
    sph.thumbImg,
    sph.ThumbImg,
    media0 && media0.thumbUrl,
    media0 && media0.ThumbUrl,
    media0 && media0.thumb,
    media0 && media0.Thumb,
    sph.thumb,
    sph.Thumb
  )
}

/**
 * 视频号：手机 SphMsgBean 认 url/des/cover/...；PC 素材字段大小写不一。
 * 收藏/素材库常见形态是封面只在 mediaList[0].thumb，cover 为空；
 * 不补齐则发出去封面错乱/无法播放。
 * @param {Object} sph
 * @returns {Object|null}
 */
export function normalizeSphPayloadForSend(sph) {
  if (!sph || typeof sph !== 'object') return null
  const mediaListRaw = Array.isArray(sph.mediaList)
    ? sph.mediaList
    : Array.isArray(sph.MediaList)
      ? sph.MediaList
      : null
  const media0 =
    mediaListRaw && mediaListRaw.length > 0 && mediaListRaw[0] && typeof mediaListRaw[0] === 'object'
      ? mediaListRaw[0]
      : null
  const mediaThumb = media0
    ? pickNonEmpty(media0.cover, media0.Cover, media0.thumb, media0.Thumb)
    : ''
  const mediaUrl = media0 ? pickNonEmpty(media0.url, media0.Url, mediaThumb) : ''
  const url = pickNonEmpty(
    sph.url,
    sph.Url,
    sph.thumbUrl,
    sph.Thumb,
    sph.cover,
    sph.Cover,
    sph.coverUrl,
    mediaUrl,
    mediaThumb
  )
  if (!url) return null
  const des = pickNonEmpty(sph.des, sph.Des, sph.desc, sph.Desc)
  const cover = pickNonEmpty(
    sph.cover,
    sph.Cover,
    sph.coverUrl,
    sph.thumbUrl,
    sph.Thumb,
    mediaThumb,
    url
  )
  const nickname = pickNonEmpty(sph.nickname, sph.Nickname, sph.nickName)
  const title = pickNonEmpty(sph.title, sph.Title)
  const id = pickNonEmpty(sph.id, sph.Id, sph.objectId)
  const nonceId = pickNonEmpty(sph.nonceId, sph.NonceId, sph.objectNonceId)
  let mediaList = mediaListRaw || sph.mediaList
  if (media0 && cover && Array.isArray(mediaList)) {
    mediaList = mediaList.map((m, i) => {
      if (i !== 0 || !m || typeof m !== 'object') return m
      const mCover = pickNonEmpty(m.cover, m.Cover)
      if (mCover) return m
      return { ...m, cover, Cover: cover }
    })
  }
  return {
    ...sph,
    url,
    Url: pickNonEmpty(sph.Url, url),
    des,
    Des: pickNonEmpty(sph.Des, des),
    desc: pickNonEmpty(sph.desc, des),
    cover,
    Cover: pickNonEmpty(sph.Cover, cover),
    nickname,
    title,
    Title: pickNonEmpty(sph.Title, title),
    id,
    nonceId,
    thumbUrl: pickNonEmpty(sph.thumbUrl, sph.Thumb, cover, url),
    Thumb: pickNonEmpty(sph.Thumb, cover, url),
    mediaList
  }
}

/**
 * 收藏/发送视频号前：拒绝 slim 占位，并把 PascalCase / mediaList.thumb 补齐为手机 hook 字段。
 * @param {string|Object|null|undefined} raw
 * @returns {Object|null}
 */
export function prepareShiPinHaoMaterialContent(raw) {
  if (raw == null) return null
  let obj = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('{')) return null
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  if (obj.slim === true || obj.slim === 'true') return null
  return normalizeSphPayloadForSend(obj)
}
