/**
 * /user/message/pageList 响应行契约校验（与前端 mapHistoryRowToTalk / pickChatField 对齐）。
 * 供 api-smoke 与 vitest 单测共用。
 */

function pickFirst(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

/**
 * 校验单行 pageList 消息；返回问题字符串数组（空 = 通过）。
 * @param {object} row
 * @param {number} [index]
 */
function validatePageListRow(row, index = 0) {
  const issues = []
  const prefix = `rows[${index}]`

  if (!row || typeof row !== 'object') {
    return [`${prefix}: 非对象`]
  }

  // 事故形状：contentType:null 与 ContentType 有效值并存，旧前端 rawType 会被 null 挡住
  if (
    Object.prototype.hasOwnProperty.call(row, 'contentType') &&
    row.contentType === null &&
    row.ContentType != null &&
    row.ContentType !== ''
  ) {
    issues.push(`${prefix}: contentType:null 与 ContentType=${JSON.stringify(row.ContentType)} 并存`)
  }

  const rawType = pickFirst(row, 'contentType', 'ContentType', 'content_type')
  const content = pickFirst(row, 'content', 'Content')

  if (content != null && String(content).trim() !== '' && (rawType === undefined || rawType === null || rawType === '')) {
    issues.push(`${prefix}: 有正文但缺 ContentType/contentType`)
  }

  if (String(content).includes('undefined')) {
    issues.push(`${prefix}: content 含字面量 undefined`)
  }

  return issues
}

/**
 * @param {object} pageListResponse 完整 HTTP 响应体 { code, data: { rows, records } }
 * @returns {{ ok: boolean, issues: string[], sampleKeys: string[] }}
 */
function validatePageListResponse(pageListResponse) {
  const issues = []
  const data = pageListResponse && pageListResponse.data
  const rows = data && Array.isArray(data.rows) ? data.rows : null

  if (!rows) {
    return { ok: false, issues: ['data.rows 非数组'], sampleKeys: [] }
  }

  if (rows.length === 0) {
    return { ok: true, issues: [], sampleKeys: [], empty: true }
  }

  rows.forEach((row, i) => {
    issues.push(...validatePageListRow(row, i))
  })

  const sampleKeys = Object.keys(rows[0] || {})
  return { ok: issues.length === 0, issues, sampleKeys, rowCount: rows.length }
}

module.exports = {
  pickFirst,
  validatePageListRow,
  validatePageListResponse
}
