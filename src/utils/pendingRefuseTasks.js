/**
 * 追踪「退还转账」任务，TakeMoneyTaskResultNotice 时区分收款与退还。
 */
const pending = new Map()
const byWxMsgKey = new Map()

export function add(taskId, info = {}) {
  const t = String(taskId)
  const w = info.wxId || info.wechatId || ''
  const m = info.msgKey || ''
  pending.set(t, { wxId: w, wechatId: w, msgKey: m })
  if (w && m) byWxMsgKey.set(`${w}:${m}`, t)
}

export function consume(taskId) {
  const key = String(taskId)
  const info = pending.get(key)
  pending.delete(key)
  if (info && info.wxId && info.msgKey) {
    byWxMsgKey.delete(`${info.wxId}:${info.msgKey}`)
  }
  return info
}

export function consumeByWxMsgKey(wxId, msgKey) {
  if (!wxId || !msgKey) return null
  const k = `${wxId}:${msgKey}`
  const taskId = byWxMsgKey.get(k)
  if (!taskId) return null
  byWxMsgKey.delete(k)
  const info = pending.get(taskId)
  pending.delete(taskId)
  return info || null
}
