import { toRaw } from 'vue'
import { workchatDB } from '@/db/dexie/database'

export function buildLocalChatDocId(userId, wxId, convId, msgRemoteId, msgId, taskId) {
  const u = String(userId == null ? '' : userId).trim()
  const w = String(wxId == null ? '' : wxId).trim()
  const c = String(convId == null ? '' : convId).trim()
  if (!u || !w || !c) return null
  const svr = msgRemoteId != null ? String(msgRemoteId).trim() : ''
  if (svr && svr !== '0') return `${u}|${w}|${c}|svr_${svr}`
  const mid = msgId != null ? String(msgId).trim() : ''
  if (mid && mid !== '0') return `${u}|${w}|${c}|msg_${mid}`
  // 发送失败的本地预览只有 TaskId（无 MsgRemoteId/MsgId）：用 TaskId 生成稳定 ID，
  // 使其能持久化到 IDB，刷新/重登后恢复（versionChecker 发版硬刷新不再丢失败气泡）
  const tid = taskId != null ? String(taskId).trim() : ''
  if (tid && tid !== '0') return `${u}|${w}|${c}|task_${tid}`
  return null
}

export function buildSessionChatIdPrefix(userId, wxId, convId) {
  const u = String(userId == null ? '' : userId).trim()
  const w = String(wxId == null ? '' : wxId).trim()
  const c = String(convId == null ? '' : convId).trim()
  if (!u || !w || !c) return ''
  return `${u}|${w}|${c}|`
}

/**
 * IndexedDB structured clone 不能写入 Vue Proxy / 函数 / 循环引用。
 * Vuex state 里的消息是响应式对象，必须先剥成纯对象再 put。
 * 优先 structuredClone(toRaw)，避免连点 OpenSession 时对每条消息 JSON.parse(JSON.stringify) 卡主线程。
 * @param {unknown} value
 * @returns {unknown}
 */
export function toPlainForIdb(value) {
  if (value == null) return value
  const raw = toRaw(value)
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(raw)
    } catch (e) {
      /* Proxy 残留 / 不可克隆字段 → 降级 */
    }
  }
  try {
    return JSON.parse(JSON.stringify(raw))
  } catch (e) {
    return sanitizeForIdb(raw)
  }
}

function sanitizeForIdb(value, depth = 0) {
  if (value == null) return value
  if (depth > 8) return null
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (t === 'bigint') return String(value)
  if (t === 'function' || t === 'symbol') return undefined
  if (value instanceof Date) return value.getTime()
  if (Array.isArray(value)) {
    return value.map((x) => sanitizeForIdb(x, depth + 1)).filter((x) => x !== undefined)
  }
  if (t === 'object') {
    const raw = toRaw(value)
    const out = {}
    for (const k of Object.keys(raw)) {
      const v = sanitizeForIdb(raw[k], depth + 1)
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return undefined
}

export async function persistMessagesToLocalChats(userId, wxId, convId, messages) {
  try {
    if (!workchatDB.isOpen()) await workchatDB.open()
    const rows = []
    for (const m of messages || []) {
      const plain = toPlainForIdb(m)
      if (!plain || typeof plain !== 'object') continue
      const id = buildLocalChatDocId(userId, wxId, convId, plain.MsgRemoteId, plain.MsgId, plain.TaskId)
      if (!id) continue
      rows.push({
        _id: id,
        userId: String(userId),
        WxId: String(wxId),
        ConvId: String(convId),
        MsgId: plain.MsgId != null ? String(plain.MsgId) : '',
        MsgRemoteId: plain.MsgRemoteId != null ? String(plain.MsgRemoteId) : '',
        CreateTime: Number(plain.CreateTime) || 0,
        payload: plain
      })
    }
    if (rows.length) await workchatDB.chats.bulkPut(rows)
  } catch (e) {
    console.warn('[historyChatLocalPersist] persist failed', e)
  }
}

export async function loadLocalChats(userId, wxId, convId, limit = 50) {
  const maxMs = 800
  const work = (async () => {
    try {
      if (!workchatDB.isOpen()) await workchatDB.open()
      const prefix = buildSessionChatIdPrefix(userId, wxId, convId)
      if (!prefix) return []
      const rows = await workchatDB.chats.where('_id').startsWith(prefix).toArray()
      // 超量时只做部分排序截断，避免上万行 sort 卡死主线程
      const capScan = Math.max(limit * 4, 200)
      let list = rows
      if (list.length > capScan) {
        // 粗筛：按 CreateTime 取候选，再精排
        list = list
          .map((r, i) => ({ r, t: Number(r.CreateTime) || 0, i }))
          .sort((a, b) => b.t - a.t || b.i - a.i)
          .slice(0, capScan)
          .map((x) => x.r)
      }
      list.sort((a, b) => (a.CreateTime || 0) - (b.CreateTime || 0))
      return list.slice(-limit).map((r) => r.payload || r)
    } catch (e) {
      console.warn('[historyChatLocalPersist] load failed', e)
      return []
    }
  })()
  try {
    return await Promise.race([
      work,
      new Promise((resolve) => {
        setTimeout(() => resolve([]), maxMs)
      })
    ])
  } catch (e) {
    console.warn('[historyChatLocalPersist] load timeout/fail', e)
    return []
  }
}

export async function persistIncomingRealtimeMessage(userId, wxId, convId, chat) {
  return persistMessagesToLocalChats(userId, wxId, convId, chat ? [chat] : [])
}

/**
 * 删除一条本地消息（含发送失败预览）。
 * 重发成功（已补 MsgRemoteId/MsgId）或撤回后调用，移除 IDB 中的旧预览，
 * 避免下次打开会话时恢复出已被取代的失败气泡。
 * @param {string} userId
 * @param {string} wxId
 * @param {string} convId
 * @param {{ MsgRemoteId?: any, MsgId?: any, TaskId?: any }} chat
 */
export async function deleteLocalChat(userId, wxId, convId, chat) {
  try {
    const id = buildLocalChatDocId(
      userId,
      wxId,
      convId,
      chat && chat.MsgRemoteId,
      chat && chat.MsgId,
      chat && chat.TaskId
    )
    if (!id) return
    if (!workchatDB.isOpen()) await workchatDB.open()
    await workchatDB.chats.delete(id)
  } catch (e) {
    /* ignore */
  }
}
