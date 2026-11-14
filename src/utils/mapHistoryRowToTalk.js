/**
 * HTTP pageList 历史行 → ShowChats 可渲染 talk 对象。
 * 从 store/conversation.js 抽出，便于单测直接 import（无需 Vuex 上下文）。
 */
import { normalizeChatFields, normalizeContentType, pickChatField } from '@/utils/chatMessageFields'
import { normalizeSenderAccountName } from '@/utils/chatSenderAccount'
import { isMsgFieldDebugEnabled, logMsgFieldAnomaly, snapshotMsgFields } from '@/utils/msgFieldDebug'
import { normalizeId, normalizeWxId } from '@/utils/wechat'

/**
 * @param {Object} row snake_case / mixed-case 消息行
 * @param {String} wxId 当前微信 id（兜底）
 * @param {String} convId 当前会话 id（兜底）
 */
export function mapHistoryRowToTalk(row, wxId, convId) {
  const rawType = pickChatField(row, 'contentType', 'ContentType', 'content_type')
  const msgTime = pickChatField(row, 'msgTime', 'msg_time', 'CreateTime', 'createTime')
  const senderAccountName = normalizeSenderAccountName(row)
  const mapped = normalizeChatFields({
    ...row,
    WxId: normalizeWxId(row.wxId || row.WxId || wxId),
    SenderId: normalizeId(pickChatField(row, 'senderId', 'SenderId', 'sender_id')),
    ConvId: normalizeId(row.convId || row.ConvId || convId),
    ContentType: normalizeContentType(rawType),
    Content: pickChatField(row, 'content', 'Content'),
    CreateTime: msgTime,
    MsgTime: msgTime,
    SenderName: row.senderName !== undefined ? row.senderName : row.SenderName,
    ...(senderAccountName ? { SenderAccountName: senderAccountName } : {}),
    MsgRemoteId: normalizeId(
      pickChatField(row, 'msgRemoteId', 'MsgRemoteId', 'msgSvrId', 'MsgSvrId', 'msg_svr_id', 'msg_remote_id')
    ),
    MsgId: normalizeId(pickChatField(row, 'msgId', 'MsgId', 'msg_id')),
    Members: row.members || row.Members || undefined
  })
  if (isMsgFieldDebugEnabled()) {
    const badTypePick = row.contentType === null && row.ContentType != null && row.ContentType !== ''
    logMsgFieldAnomaly('http.map', mapped, {
      rawType,
      rawTypePick: badTypePick ? 'contentType:null blocked ContentType' : '',
      rawSnap: snapshotMsgFields(row)
    })
  }
  return mapped
}
