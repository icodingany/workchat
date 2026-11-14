/**
 * TaskId 查找键：protobuf int64 经 JSON 常以 number 传输，浏览器会丢精度。
 * 匹配时同时尝试精确字符串与 Number 舍入后的字符串（对齐 kelailaichatpc）。
 */
export function getTaskIdLookupKeys(taskId) {
  if (taskId == null) return []
  const exactKey = String(taskId)
  if (!exactKey) return []

  const keys = [exactKey]
  const numericKey = Number(exactKey).toString()
  if (
    numericKey !== exactKey &&
    numericKey !== 'NaN' &&
    numericKey !== 'Infinity' &&
    numericKey !== '-Infinity'
  ) {
    keys.push(numericKey)
  }
  return keys
}

export function getTaskIdRoundedKey(taskId) {
  return getTaskIdLookupKeys(taskId)[1] || ''
}

/**
 * 两侧 TaskId 是否指向同一任务（含精度舍入兼容）
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function taskIdsMatch(a, b) {
  if (a == null || b == null) return false
  const keysA = getTaskIdLookupKeys(a)
  const keysB = new Set(getTaskIdLookupKeys(b))
  return keysA.some((k) => keysB.has(k))
}
