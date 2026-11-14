/** WebSocket 出站队列：断线/未认证时暂存待发帧，连接恢复后 flush */

export const DEFAULT_OUTBOUND_MESSAGE_QUEUE_MAX = 1000

function resolveDedupeKey(message) {
  if (!message || typeof message !== 'object') return null
  if (message.MsgType === 'DeviceAuthReq') return '__auth__'
  const content = message.Content
  if (content && typeof content === 'object') {
    const taskId = content.TaskId ?? content.taskId
    if (taskId != null && String(taskId).trim() !== '') {
      return 'task:' + String(taskId)
    }
  }
  return null
}

export function enqueueOutboundMessage(queue, message, options = {}) {
  if (!Array.isArray(queue)) return queue

  const maxSize =
    Number.isFinite(options.maxSize) && options.maxSize > 0
      ? Math.floor(options.maxSize)
      : DEFAULT_OUTBOUND_MESSAGE_QUEUE_MAX
  const mode = options.mode === 'front' ? 'front' : 'back'

  const dedupeKey = resolveDedupeKey(message)
  if (dedupeKey) {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (resolveDedupeKey(queue[i]) === dedupeKey) {
        queue.splice(i, 1)
      }
    }
  }

  if (mode === 'front') {
    queue.unshift(message)
  } else {
    queue.push(message)
  }

  trimOutboundMessageQueue(queue, { maxSize })
  return queue
}

export function trimOutboundMessageQueue(queue, options = {}) {
  if (!Array.isArray(queue)) return queue

  const maxSize =
    Number.isFinite(options.maxSize) && options.maxSize > 0
      ? Math.floor(options.maxSize)
      : DEFAULT_OUTBOUND_MESSAGE_QUEUE_MAX
  const overflow = queue.length - maxSize

  if (overflow > 0) {
    queue.splice(0, overflow)
    console.warn('[WS出站队列] 已达上限，丢弃最旧待发帧', { droppedCount: overflow, queueMax: maxSize })
  }

  return queue
}
