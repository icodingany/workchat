import fetch from '@/utils/fetch'

/**
 * 分页查询激活码（wework-server 代理中央 s.example.invalid）
 */
export function getRegCodeList(keys, page, rows, used) {
  return fetch.get('/api/regcode/pageList', { keys, page, rows, used })
}

export function batchGenerateRegCode(count, days) {
  return fetch.post('/api/regcode/batchGenerate', { count, days })
}

export function distoryRegCode(regCode) {
  return fetch.post('/api/regcode/distory', { regCode })
}

export function disableRegCode(regCode) {
  return fetch.post('/api/regcode/reg_code_disabled', { regCode })
}

export function enableRegCode(regCode) {
  return fetch.post('/api/regcode/restore', { regCode })
}

export function updateRegCodeDays(regCode, days) {
  return fetch.post('/api/regcode/reg_code_update', { regCode, days })
}

export function restoreRegCode(regCode) {
  return fetch.post('/api/regcode/restore', { regCode })
}
