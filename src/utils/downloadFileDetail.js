import base64 from '@/utils/base64'
import { sameId } from '@/utils/wechat'

/** 手机端拉取资源失败时，展示在图片/资源下方的文案（不弹全局 toast） */
export const RESOURCE_FETCH_FAIL_MSG = '资源地址获取失败'

/**
 * WS Content 为 base64；HTTP 历史为明文（文本/JSON）。
 * @param {string} content
 * @returns {string}
 */
export function decodeMsgContent(content) {
  if (!content || typeof content !== 'string') return content || ''
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<')) {
    return content
  }
  try {
    return base64.decode(content)
  } catch (e) {
    return content
  }
}

/**
 * 将 DownloadFileResultNotice.Url 写入消息 Content。
 * 兼容 HTTP 明文 JSON 与 WS base64；写入后保持原存储形态。
 * @param {string} rawContent
 * @param {string} url
 * @returns {{ content: string, ok: boolean }}
 */
export function applyDownloadUrlToMsgContent(rawContent, url) {
  if (!url || rawContent === null || rawContent === undefined || rawContent === '') {
    return { content: rawContent, ok: false }
  }
  try {
    const decoded = decodeMsgContent(String(rawContent))
    const obj = JSON.parse(decoded)
    if (!obj || typeof obj !== 'object') {
      return { content: rawContent, ok: false }
    }
    obj.url = url
    const json = JSON.stringify(obj)
    const trimmed = String(rawContent).trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { content: json, ok: true }
    }
    return { content: base64.encode(json), ok: true }
  } catch (e) {
    return { content: rawContent, ok: false }
  }
}

/**
 * DownloadFileResultNotice 无 Url 时：在对应消息上标记失败，供气泡内图片下方展示。
 * @param {Array} messages
 * @param {string|number} msgId
 * @returns {Array|null} 新数组；未命中返回 null
 */
export function markMessageResourceFetchFailed(messages, msgId) {
  if (!Array.isArray(messages) || !messages.length || msgId == null) return null
  const idx = messages.findIndex((m) => sameId(m.MsgId, msgId))
  if (idx < 0) return null
  const message = messages[idx]
  const next = messages.slice()
  next[idx] = {
    ...message,
    _resourceFetchError: RESOURCE_FETCH_FAIL_MSG,
    __decodedHtml: undefined
  }
  return next
}
