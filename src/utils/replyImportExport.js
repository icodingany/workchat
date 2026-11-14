/**
 * 公共话术批量导入导出（适配 workchat 单层分组 + 单条 content）
 *
 * 表头与 kelailaichatpc 对齐以便文件互通：
 * 顶级分组 | 二级分组 | 话术标题 | 消息类型 | 消息内容 | 多条消息间隔(秒)
 * - 二级分组 = 现有术语分组名；顶级分组列可留空，当前系统忽略
 * - 多行内容合并为一条 content 落库；间隔列解析保留但落库忽略
 */

import * as XLSX from 'xlsx'

export const CTYPE_VALUE_TO_LABEL = {
  1: '文本',
  2: '图片',
  3: '视频',
  4: '语音',
  5: '文件'
}

export const CTYPE_LABEL_TO_VALUE = {
  文本: 1,
  图片: 2,
  视频: 3,
  语音: 4,
  文件: 5,
  文本类型: 1,
  图片类型: 2,
  视频类型: 3,
  语音类型: 4,
  其他文件: 5,
  其他文件类型: 5,
  文件类型: 5
}

export const REPLY_CTYPE_OPTIONS = ['文本', '图片', '视频', '语音', '文件']

export const IMPORT_HEADERS = [
  '顶级分组',
  '二级分组',
  '话术标题',
  '消息类型',
  '消息内容',
  '多条消息间隔(秒)'
]

export const EXPORT_HEADERS = [...IMPORT_HEADERS]

const HEADER_MATCHERS = [
  { key: 'topGroup', keywords: ['顶级分组', '顶级话术组', '顶级'] },
  { key: 'subGroup', keywords: ['二级分组', '所属分组', '二级', '分组', '术语分组'] },
  { key: 'name', keywords: ['话术标题', '术语标题', '标题'] },
  { key: 'ctype', keywords: ['消息类型', '类型'] },
  { key: 'content', keywords: ['消息内容', '内容'] },
  { key: 'delay', keywords: ['间隔'] }
]

export function ctypeToLabel(ctype) {
  const n = Number(ctype)
  return CTYPE_VALUE_TO_LABEL[n] || '文本'
}

export function labelToCtype(label) {
  if (label == null) return 1
  const key = String(label).trim()
  if (/^\d+$/.test(key)) {
    const n = Number(key)
    return CTYPE_VALUE_TO_LABEL[n] ? n : 1
  }
  return CTYPE_LABEL_TO_VALUE[key] || 1
}

export function extractTermMessages(term) {
  if (!term) return []
  let msgs = term.messages
  if (!Array.isArray(msgs) || msgs.length === 0) {
    const jsonStr = term.messagesJson || term.messages_json || term.message_json
    if (typeof jsonStr === 'string' && jsonStr.trim()) {
      try {
        msgs = JSON.parse(jsonStr)
      } catch (_) {
        msgs = []
      }
    }
  }
  if (Array.isArray(msgs) && msgs.length > 0) {
    return msgs.map((m, idx) => ({
      ctype: Number(m.ctype != null ? m.ctype : m.type != null ? m.type : term.ctype || 1),
      type: String(m.type != null ? m.type : m.ctype != null ? m.ctype : term.ctype || 1),
      content: String(m.content || ''),
      seq: m.seq != null ? m.seq : idx,
      delay: m.delay != null ? m.delay : 2
    }))
  }
  if (term.content) {
    return [
      {
        ctype: Number(term.ctype || 1),
        type: String(term.ctype || 1),
        content: String(term.content),
        seq: 0,
        delay: 2
      }
    ]
  }
  return []
}

/**
 * term 列表 -> Excel 行。单层分组时二级=分组名，顶级留空。
 */
export function buildReplyExportRows(terms) {
  if (!Array.isArray(terms)) return []
  return terms.map((term) => {
    const messages = extractTermMessages(term)
    const subName = term.tname || term.group_name || term.groupName || ''
    const topName = term.parentTname || term.parent_tname || ''
    const name = term.name || ''
    const firstCtype = messages.length > 0 ? messages[0].ctype : Number(term.ctype || 1)
    const ctypeLabel = ctypeToLabel(firstCtype)
    const content = messages.map((m) => m.content || '').join('\n')
    const delay = messages.length > 0 ? Number(messages[0].delay || 2) : 2
    return [topName, subName, name, ctypeLabel, content, delay]
  })
}

function buildMessagesFromCell(ctype, rawContent, delay) {
  const segments = String(rawContent || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (segments.length === 0) return []
  return segments.map((seg, idx) => ({
    ctype: Number(ctype),
    type: String(ctype),
    content: seg,
    seq: idx,
    delay: Number(delay) >= 0 ? Number(delay) : 2
  }))
}

function resolveColumns(headerRow) {
  if (!Array.isArray(headerRow) || headerRow.length === 0) return null
  const map = {}
  headerRow.forEach((cell, idx) => {
    const text = String(cell == null ? '' : cell).trim()
    if (!text) return
    for (const m of HEADER_MATCHERS) {
      if (map[m.key] !== undefined) continue
      if (m.keywords.some((kw) => text.includes(kw))) {
        map[m.key] = idx
        break
      }
    }
  })
  if (map.subGroup === undefined || map.name === undefined || map.content === undefined) {
    return null
  }
  return map
}

/**
 * @returns {{ valid: Array, invalid: Array<{row:number,reason:string}> }}
 */
export function parseReplyImportRows(matrix) {
  const valid = []
  const invalid = []
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { valid, invalid }
  }
  const cols = resolveColumns(matrix[0])
  if (!cols) {
    return { valid, invalid: [{ row: 1, reason: '未识别到表头，请使用下载的模板填写' }] }
  }
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] || []
    const rowNo = i + 1
    const topName =
      cols.topGroup !== undefined && row[cols.topGroup] != null
        ? String(row[cols.topGroup]).trim()
        : ''
    const subName = row[cols.subGroup] != null ? String(row[cols.subGroup]).trim() : ''
    const name = row[cols.name] != null ? String(row[cols.name]).trim() : ''
    const ctypeRaw =
      cols.ctype !== undefined && row[cols.ctype] != null ? String(row[cols.ctype]).trim() : ''
    const contentRaw = row[cols.content] != null ? String(row[cols.content]).trim() : ''
    const delayRaw = cols.delay !== undefined ? row[cols.delay] : undefined

    if (!topName && !subName && !name && !ctypeRaw && !contentRaw) continue

    if (!subName) {
      invalid.push({ row: rowNo, reason: '缺少二级分组（术语分组）' })
      continue
    }
    if (!name) {
      invalid.push({ row: rowNo, reason: '缺少话术标题' })
      continue
    }
    const ctype = labelToCtype(ctypeRaw || '文本')
    const delay = Number(delayRaw) >= 0 ? Number(delayRaw) : 2
    const messages = buildMessagesFromCell(ctype, contentRaw, delay)
    if (messages.length === 0) {
      invalid.push({ row: rowNo, reason: '消息内容为空' })
      continue
    }
    valid.push({ topName, subName, name, ctype, messages })
  }
  return { valid, invalid }
}

function triggerBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

/**
 * 下载导入模板（表头+示例+填写说明）
 */
export function downloadReplyExcelTemplate(filename = '话术导入模板.xlsx') {
  const data = [
    IMPORT_HEADERS,
    ['售后', '退换货', '退款流程', '文本', '您好，退款请提供订单号\n稍后为您处理', 2],
    ['', '常见问题', '产品图', '图片', 'https://file.example.invalid/pub/demo.png', 2],
    ['售前', '报价', '多图文', '文本', '欢迎咨询\n这是第二条文本', 3]
  ]
  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 50 },
    { wch: 18 }
  ]

  const guide = [
    ['话术导入模板填写说明'],
    [],
    ['一、各列填写规则'],
    ['列名', '是否必填', '填写说明'],
    ['顶级分组', '选填', '当前系统为单层分组，此列可留空，导入时忽略。'],
    ['二级分组', '必填', '术语分组名称；不存在会自动创建。'],
    ['话术标题', '必填', '话术显示名称，最多 20 字。'],
    [
      '消息类型',
      '选填',
      '填写：文本/图片/视频/语音/文件；留空默认「文本」。'
    ],
    [
      '消息内容',
      '必填',
      '多行内容会合并为一条话术（换行保留）。图片/视频/语音/文件须填已上传的服务器 URL，不能填本地路径。'
    ],
    ['多条消息间隔(秒)', '选填', '当前系统单条落库，此列可留空，导入时忽略。'],
    [],
    ['二、消息类型对照'],
    ['类型', 'ctype', '内容要求'],
    ['文本', '1', '直接填写文字内容'],
    ['图片', '2', '填写图片的服务器URL'],
    ['视频', '3', '填写视频的服务器URL'],
    ['语音', '4', '填写语音文件的服务器URL（amr/mp3）'],
    ['文件', '5', '填写文件的服务器URL'],
    [],
    ['三、注意事项'],
    ['1. 二级分组对应管理端「术语分组」；缺失时自动创建。'],
    ['2. 多行消息内容会合并成一条话术写入。'],
    ['3. 媒体类型内容列必须填服务器 URL。'],
    ['4. 标题、二级分组、消息内容为必填。'],
    ['5. 建议先少量测试（2-3 条）确认无误后再批量导入。']
  ]
  const sheet2 = XLSX.utils.aoa_to_sheet(guide)
  sheet2['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 70 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '话术导入')
  XLSX.utils.book_append_sheet(wb, sheet2, '填写说明')
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  triggerBlobDownload(blob, filename)
}

/**
 * 导出话术列表为 Excel
 */
export function exportRepliesToExcel(terms, filename = '话术导出.xlsx') {
  const rows = buildReplyExportRows(terms)
  const data = [EXPORT_HEADERS, ...rows]
  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 50 },
    { wch: 18 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '话术导出')
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  triggerBlobDownload(blob, filename)
}

/**
 * 读取 Excel 为二维数组
 * @param {File} file
 * @returns {Promise<Array<Array>>}
 */
export function readReplyExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1 }))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = (err) => reject(err)
    reader.readAsArrayBuffer(file)
  })
}
