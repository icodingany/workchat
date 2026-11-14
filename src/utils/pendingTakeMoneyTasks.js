/**
 * 追踪开红包/收转账任务：超时无 TakeMoneyTaskResultNotice 时提示，避免一直「等待手机」。
 */
import { ElMessage as Message } from 'element-plus'

const pending = new Map()
const TIMEOUT_MS = 45_000

/**
 * @param {string|number} taskId
 * @param {{ label?: string }} [info]
 */
export function addPendingTakeMoneyTask(taskId, info = {}) {
  const key = String(taskId)
  clearPendingTakeMoneyTask(key)
  const label = info.label || '开红包/收转账'
  const timer = setTimeout(() => {
    pending.delete(key)
    Message({
      type: 'warning',
      message: `${label}超时无手机回执，请确认企微已打开、SCRM 在线后重试`,
      duration: 4000
    })
  }, TIMEOUT_MS)
  pending.set(key, { timer, label })
}

export function clearPendingTakeMoneyTask(taskId) {
  if (taskId == null || taskId === '') return
  const key = String(taskId)
  const entry = pending.get(key)
  if (!entry) return
  clearTimeout(entry.timer)
  pending.delete(key)
}

/** 任意一条结果回执到达时清理（按 TaskId；无 TaskId 则清全部超时） */
export function clearPendingTakeMoneyOnResult(message) {
  const tid = message && (message.TaskId != null ? message.TaskId : message.taskId)
  if (tid != null && tid !== '' && tid !== 0 && tid !== '0') {
    clearPendingTakeMoneyTask(tid)
    return
  }
  for (const key of [...pending.keys()]) {
    clearPendingTakeMoneyTask(key)
  }
}
