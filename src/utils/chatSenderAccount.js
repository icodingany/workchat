/**
 * 归一消息上的操作员发送人账号（对齐 kelailaichatpc chatWire）
 * @param {Object} chat
 * @returns {string}
 */
export function normalizeSenderAccountName(chat) {
  if (!chat || typeof chat !== 'object') return ''
  let direct = chat.SenderAccountName
  if (direct == null || direct === '') direct = chat.senderAccountName
  if (direct == null || direct === '') direct = chat.sender_account_name
  if (direct != null && String(direct).trim()) return String(direct).trim()
  const sa = chat.sender_account || chat.SenderAccount
  if (sa && typeof sa === 'object') {
    const account = sa.account != null ? sa.account : sa.Account
    if (account != null && String(account).trim()) return String(account).trim()
  }
  return ''
}

/**
 * 就地写入 SenderAccountName
 * @param {Object} chat
 * @returns {Object}
 */
export function applySenderAccountFields(chat) {
  if (!chat || typeof chat !== 'object') return chat
  const name = normalizeSenderAccountName(chat)
  if (name) chat.SenderAccountName = name
  return chat
}
