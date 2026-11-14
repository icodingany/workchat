/**
 * 企微引用消息：解析 quote JSON、appinfo 兜底、气泡 HTML、定位 id。
 */
import { pickChatField } from '@/utils/chatMessageFields'

const APPINFO_QUOTE_RE = /^wxid_[a-z0-9_]+:\d+:\d+$/i

/** @param {unknown} text */
export function isAppinfoQuoteText(text) {
  return typeof text === 'string' && APPINFO_QUOTE_RE.test(text.trim())
}

/** @param {string|number|null|undefined} a @param {string|number|null|undefined} b */
export function msgRemoteIdMatch(a, b) {
  if (a == null || b == null || a === '' || b === '') return false
  return String(a).trim() === String(b).trim()
}

/**
 * @param {Array<object>|null|undefined} chats
 * @param {string|number|null|undefined} targetId
 */
export function findQuotedMessageInChats(chats, targetId) {
  if (!targetId || !Array.isArray(chats)) return null
  return (
    chats.find((m) => msgRemoteIdMatch(pickChatField(m, 'MsgRemoteId', 'msgRemoteId'), targetId)) ||
    null
  )
}

const TYPE_PREVIEW = {
  Text: (m) => pickChatField(m, 'Content', 'content') || '',
  1: (m) => pickChatField(m, 'Content', 'content') || '',
  Picture: () => '[图片]',
  2: () => '[图片]',
  Voice: () => '[语音]',
  3: () => '[语音]',
  Video: () => '[视频]',
  4: () => '[视频]',
  Link: () => '[链接]',
  6: () => '[链接]',
  File: () => '[文件]',
  8: () => '[文件]',
  LuckyMoney: () => '[红包]',
  11: () => '[红包]',
  MoneyTrans: () => '[转账]',
  12: () => '[转账]',
  QuoteMsg: (m) => resolveQuotedMessagePreview(m),
  22: (m) => resolveQuotedMessagePreview(m)
}

/**
 * @param {object|null|undefined} msg
 * @returns {string}
 */
export function resolveQuotedMessagePreview(msg) {
  if (!msg || typeof msg !== 'object') return ''
  const ct = pickChatField(msg, 'ContentType', 'contentType', 'content_type')
  const fn = TYPE_PREVIEW[ct]
  if (typeof fn === 'function') {
    const v = fn(msg)
    if (v != null && String(v).trim()) return String(v).trim()
  }
  const raw = pickChatField(msg, 'Content', 'content')
  return raw != null ? String(raw).trim() : ''
}

/**
 * 企微 quote JSON：补全被引用正文与 msgRid（appinfo 泄漏时从 currentChats 回查）。
 * @param {object|null|undefined} jContent
 * @param {Array<object>|null|undefined} chats
 */
export function resolveWeworkQuoteFields(jContent, chats) {
  if (!jContent || typeof jContent !== 'object') return jContent
  const quote = jContent.quote && typeof jContent.quote === 'object' ? { ...jContent.quote } : {}
  let quoteText = quote.text != null ? String(quote.text) : ''
  let quoteMsgRid = quote.msgRid ?? quote.msg_rid ?? ''

  const needsResolve = !quoteText.trim() || isAppinfoQuoteText(quoteText)
  if (needsResolve) {
    const rid = quoteMsgRid != null && String(quoteMsgRid).trim() ? String(quoteMsgRid).trim() : ''
    const quoted = rid ? findQuotedMessageInChats(chats, rid) : null
    if (quoted) {
      const preview = resolveQuotedMessagePreview(quoted)
      if (preview) quoteText = preview
      const foundRid = pickChatField(quoted, 'MsgRemoteId', 'msgRemoteId')
      if (foundRid != null && foundRid !== '') quoteMsgRid = foundRid
    } else if (isAppinfoQuoteText(quoteText)) {
      quoteText = ''
    }
  }

  return {
    ...jContent,
    quote: {
      ...quote,
      text: quoteText,
      msgRid: quoteMsgRid
    }
  }
}

/**
 * @param {{ replyHtml: string, quoteName?: string, quoteHtml?: string, quoteMsgRid?: string|number }} p
 */
export function buildWeworkQuoteBubbleHtml({ replyHtml, quoteName, quoteHtml, quoteMsgRid }) {
  const rid = quoteMsgRid != null && String(quoteMsgRid).trim() ? String(quoteMsgRid).trim() : ''
  const clickAttr =
    rid && /^\d+$/.test(rid)
      ? ` onclick="event.stopPropagation();window.__handleQuoteMessageClick && window.__handleQuoteMessageClick('${rid}')"`
      : ''
  const name = quoteName != null ? String(quoteName).trim() : ''
  const nameHtml = name ? `<span class="chat-quote-ref-name">${name}:</span>` : ''
  const body = quoteHtml != null ? String(quoteHtml) : ''
  return (
    `<div class="chat-quote-msg">` +
    `<div class="chat-quote-reply">${replyHtml || ''}</div>` +
    `<div class="chat-quote-ref"${clickAttr}>` +
    `<span class="chat-quote-ref-bar" aria-hidden="true"></span>` +
    `<div class="chat-quote-ref-body">${nameHtml}<span class="chat-quote-ref-text">${body}</span></div>` +
    `</div></div>`
  )
}
