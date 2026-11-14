/**
 * 消息气泡 CSS class（ShowChats / FriendChatMessageList 共用）。
 * 依赖 ContentType 已 normalize 或为数字枚举，内部走 isContentType。
 */
import { isContentType } from '@/utils/chatMessageFields'

const SYSTEM_TYPES = ['System', 'Sys_LuckyMoney', 'RoomSystem']

/** @param {string|number|null|undefined} ct */
export function isSystemContentType(ct) {
  return SYSTEM_TYPES.some((t) => isContentType(ct, t))
}

/** @param {string|number|null|undefined} ct */
export function isLinkBubbleType(ct) {
  return (
    isContentType(ct, 'Link') ||
    isContentType(ct, 'BizLink') ||
    isContentType(ct, 'ForwardMsg') ||
    isContentType(ct, 'AppFunCard') ||
    isContentType(ct, 'Location') ||
    isContentType(ct, 'NotifyMsg')
  )
}

/**
 * @param {string|number|null|undefined} contentType
 * @returns {Record<string, boolean>}
 */
export function chatContentClasses(contentType) {
  return {
    'chat-picture': isContentType(contentType, 'Picture'),
    'chat-voice': isContentType(contentType, 'Voice'),
    'chat-video': isContentType(contentType, 'Video'),
    'chat-link': isLinkBubbleType(contentType),
    'chat-file': isContentType(contentType, 'File'),
    'chat-namecard': isContentType(contentType, 'NameCard'),
    'chat-luckmoney': isContentType(contentType, 'LuckyMoney'),
    'chat-moneytran': isContentType(contentType, 'MoneyTrans'),
    'chat-app': isContentType(contentType, 'WeApp') || isContentType(contentType, 'ShiPinHao'),
    'chat-system': isSystemContentType(contentType)
  }
}

/** ShowChats notShow：不展示头像的系统类消息 */
export function isHiddenAvatarContentType(ct) {
  return isSystemContentType(ct)
}
