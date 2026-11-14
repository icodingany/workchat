/**
 * 自动回复列表行 → decodeChatHtml 可消费的 chat 形状。
 */
import { normalizeContentType } from '@/utils/chatMessageFields'
import { decodeChatHtml } from '@/utils/decodeChatHtml'

const RESOURCE_TYPE_NAME = {
  1: 'Text',
  2: 'Picture',
  3: 'Voice',
  4: 'Video',
  6: 'Link',
  13: 'WeApp'
}

/** 语音 URL：amr→mp3、去掉 duration 参数（对齐原 AutoReply.decodeChat） */
export function normalizeAutoReplyVoiceUrl(content) {
  if (!content || typeof content !== 'string') return content || ''
  let c = content.replace('?duration=2', '')
  if (c.endsWith('.amr')) return c.replace(/.amr$/, '.mp3')
  return c.replace(/.mp3:[0-9]+/, '.mp3')
}

/**
 * @param {object|null|undefined} row 自动回复配置行
 * @returns {object|null}
 */
export function mapAutoReplyRowToChat(row) {
  if (!row) return null
  const raw = row.returnString != null ? String(row.returnString) : ''
  const rt = row.resourceType
  const ContentType = normalizeContentType(RESOURCE_TYPE_NAME[rt] || rt)
  let Content = raw
  let jContent

  if (ContentType === 'Voice' || rt === 3) {
    Content = normalizeAutoReplyVoiceUrl(raw)
  } else if (
    (ContentType === 'Link' || ContentType === 'WeApp' || rt === 6 || rt === 13) &&
    raw.trim().startsWith('{')
  ) {
    try {
      jContent = JSON.parse(raw)
    } catch (_) {
      /* keep raw Content */
    }
  }

  const chat = { Content, ContentType }
  if (jContent) chat.jContent = jContent
  return chat
}

/**
 * @param {object|null|undefined} row
 * @returns {string}
 */
export function decodeAutoReplyHtml(row) {
  const chat = mapAutoReplyRowToChat(row)
  if (!chat) return ''
  return decodeChatHtml(chat, { useCache: false, pictureOnerror: false })
}
