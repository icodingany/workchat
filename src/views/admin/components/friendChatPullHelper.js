/**
 * 管理端好友聊天弹窗：分页合并 / 手机拉取轮询工具（纯函数，无 Vuex 依赖）
 */

function normalizeMsgTimeMs(t) {
  if (t === null || t === undefined || t === '') return 0
  let n = Number(t)
  if (!Number.isFinite(n)) {
    const parsed = Date.parse(t)
    n = Number.isFinite(parsed) ? parsed : 0
  }
  if (n > 0 && n < 1e12) n *= 1000
  return n
}

function sortChatsAsc(a, b) {
  const ta = normalizeMsgTimeMs(a && (a.MsgTime != null ? a.MsgTime : a.CreateTime))
  const tb = normalizeMsgTimeMs(b && (b.MsgTime != null ? b.MsgTime : b.CreateTime))
  if (ta !== tb) return ta - tb
  const ra = Number(a && a.MsgRemoteId) || 0
  const rb = Number(b && b.MsgRemoteId) || 0
  if (ra !== rb) return ra - rb
  const ma = Number(a && a.MsgId) || 0
  const mb = Number(b && b.MsgId) || 0
  if (ma !== mb) return ma - mb
  return (Number(a && a.id) || 0) - (Number(b && b.id) || 0)
}

export function computeHasMore(page, rows, total) {
  const p = Number(page) || 0
  const r = Number(rows) || 0
  const t = Number(total) || 0
  return p > 0 && r > 0 && p * r < t
}

export function mergeEarlierMessages(existing, earlier) {
  const list = []
  const seen = new Set()
  const pushUnique = (arr) => {
    const items = arr || []
    items.forEach((m) => {
      const key =
        m && (m.MsgId != null && m.MsgId !== '' ? `id:${m.MsgId}` : `r:${m.MsgRemoteId}|t:${m.MsgTime}`)
      if (seen.has(key)) return
      seen.add(key)
      list.push(m)
    })
  }
  pushUnique(earlier)
  pushUnique(existing)
  list.sort(sortChatsAsc)
  return list
}

export function shouldPhonePull({ page, keyword, rows }) {
  return Number(page) === 1 && !String(keyword || '').trim() && (!rows || rows.length === 0)
}

export function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const PHONE_PULL_FAST_ROUNDS = 8
export const PHONE_PULL_FAST_MS = 250
export const PHONE_PULL_SLOW_MS = 700
export const PHONE_PULL_MAX_ROUNDS = 32

export function phonePullIntervalMs(round) {
  return round < PHONE_PULL_FAST_ROUNDS ? PHONE_PULL_FAST_MS : PHONE_PULL_SLOW_MS
}
