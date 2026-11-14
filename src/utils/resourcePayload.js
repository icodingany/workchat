import { prepareShiPinHaoMaterialContent } from '@/utils/shiPinHaoPayload'

/**
 * 我的收藏资源 → TalkToFriendTask 发送内容（PC ToolsBar 与移动端聊天页共用）。
 * @param {String} type 资源类型 Text/Picture/Video/Link/WeApp/ShiPinHao
 * @param {*} content 资源内容（Text 为字符串，其余为对象）
 * @returns {{type: String, content: String}|null} 无法映射返回 null
 */
export function buildResourceSend(type, content) {
  if (type === 'Text') return { type, content }
  if (type === 'Picture') return { type, content: content.url }
  if (type === 'Video') return { type, content: (content && content.url) || content }
  if (type === 'Link' || type === 'WeApp') return { type, content: JSON.stringify(content) }
  if (type === 'ShiPinHao' || type === 25 || type === '25') {
    // 禁止把视频号 JSON 的 .url 抽成 Video 直链发送（会变成普通视频卡片且无法打开视频号）
    const prepared = prepareShiPinHaoMaterialContent(content)
    if (!prepared) return null
    return { type: 'ShiPinHao', content: JSON.stringify(prepared) }
  }
  return null
}

/** 旧数字素材类型 → 协议名（对齐素材库 TYPE_MAP） */
const NUM_TYPE_MAP = {
  1: 'Text',
  2: 'Picture',
  3: 'Voice',
  4: 'Video',
  6: 'Link',
  8: 'File',
  13: 'WeApp',
  14: 'Emoji',
  25: 'ShiPinHao'
}

/**
 * 归一化素材类型：旧数字（2/3/4/6/8/13/14/25）→ 协议名，协议名原样返回。
 * @param {String|Number} type
 * @returns {String}
 */
export function normalizeMaterialType(type) {
  if (type == null || type === '') return ''
  if (Object.prototype.hasOwnProperty.call(NUM_TYPE_MAP, String(type))) {
    return NUM_TYPE_MAP[String(type)]
  }
  return String(type)
}

/**
 * 客户端按协议名过滤素材行：库内新旧 type 混存（'Picture' 与 2 等），
 * 后端 pageList 的 type 是精确匹配，按协议名查会漏掉全部数字行——
 * 选择弹窗改为拉全量后在側过滤。
 * @param {Array} rows 素材行列表
 * @param {String} type 协议名（Text/Picture/…）
 * @returns {Array}
 */
export function filterMaterialsByType(rows, type) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => row && normalizeMaterialType(row.type) === type)
}

/**
 * 解析素材 content：JSON 字符串 → 对象，否则原样返回（字符串或对象）。
 * @param {*} content
 * @returns {*}
 */
export function parseMaterialContent(content) {
  if (content == null) return ''
  if (typeof content === 'object') return content
  const s = String(content).trim()
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return JSON.parse(s)
    } catch (e) {
      /* fallthrough */
    }
  }
  return s
}

/** 从解析后的素材内容提取 URL */
function pickMaterialUrl(c) {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object') return c.url || c.Url || c.cdnUrl || ''
  return ''
}

/** 群发消息（MsgComposer msgList）支持的素材类型；Emoji/ShiPinHao 后端会错误降级为 Text，禁止 */
const COMPOSER_TYPES = ['Text', 'Picture', 'Voice', 'Video', 'File', 'Link', 'WeApp']

/**
 * 收藏素材 → MsgComposer msgList 消息（群发「从素材库选择」）。
 * @param {Object} row 素材行 {type, content}
 * @returns {{ContentType:String, Content:String, desc:String, thumbUrl?:String, jContent?:Object}|null}
 */
export function materialToComposerMsg(row) {
  if (!row) return null
  const type = normalizeMaterialType(row.type)
  if (COMPOSER_TYPES.indexOf(type) < 0) return null
  const c = parseMaterialContent(row.content)
  if (type === 'Text') {
    const text = typeof c === 'string' ? c : JSON.stringify(c)
    if (!text.trim()) return null
    return { ContentType: 'Text', Content: text, desc: text }
  }
  if (type === 'Link' || type === 'WeApp') {
    if (!c || typeof c !== 'object') return null
    return {
      ContentType: type,
      Content: JSON.stringify(c),
      jContent: c,
      desc: c.title || c.appName || '链接',
      thumbUrl: c.thumbUrl || c.iconUrl || ''
    }
  }
  const url = pickMaterialUrl(c)
  if (!url) return null
  if (type === 'Picture') return { ContentType: 'Picture', Content: url, desc: '图片', thumbUrl: url }
  if (type === 'Video') return { ContentType: 'Video', Content: url, desc: '视频', thumbUrl: url }
  if (type === 'Voice') return { ContentType: 'Voice', Content: url, desc: '语音' }
  return { ContentType: 'File', Content: url, desc: '文件' }
}

/** 朋友圈支持的素材类型 */
const CIRCLE_TYPES = ['Text', 'Picture', 'Video', 'Link']

/**
 * 收藏素材 → 发朋友圈表单回填 patch（FriendCircleSend「从素材库选择」）。
 * @param {Object} row 素材行 {type, content}
 * @returns {{circleType:String, text?:String, imageUrls?:String[], video?:String, linkUrl?:String, linkTitle?:String, linkImg?:String}|null}
 */
export function materialCircleFill(row) {
  if (!row) return null
  const type = normalizeMaterialType(row.type)
  if (CIRCLE_TYPES.indexOf(type) < 0) return null
  const c = parseMaterialContent(row.content)
  if (type === 'Text') {
    const text = typeof c === 'string' ? c : JSON.stringify(c)
    return { circleType: 'text', text }
  }
  if (type === 'Picture') {
    const url = pickMaterialUrl(c)
    return url ? { circleType: 'picture', imageUrls: [url] } : null
  }
  if (type === 'Video') {
    const url = pickMaterialUrl(c)
    return url ? { circleType: 'video', video: url } : null
  }
  if (!c || typeof c !== 'object') return null
  return {
    circleType: 'link',
    linkUrl: c.url || c.Url || '',
    linkTitle: c.title || c.Title || '',
    linkImg: c.thumbUrl || c.img || c.image || ''
  }
}
