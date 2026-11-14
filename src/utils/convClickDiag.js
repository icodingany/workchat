/**
 * 会话点击诊断：console + sessionStorage 环形缓冲（轻量，避免连点时 JSON 大对象卡主线程）。
 * 整页卡死无法复制控制台时，强刷后执行：
 *   copy(JSON.stringify(window.__dumpConvClickDiag(), null, 2))
 *
 * dump 含 rows + hb（主线程心跳）。若前台时 hb 停/lag 飙高，才是真卡死。
 */
const STORAGE_KEY = 'workchat_conv_click_diag'
const HB_KEY = 'workchat_conv_click_hb'
const MAX_ROWS = 80
const MAX_HB = 40

export function convDiag(tag, payload) {
  const row = {
    t: Date.now(),
    tag: String(tag || ''),
    ...(payload && typeof payload === 'object' && !Array.isArray(payload)
      ? sanitizeLight(payload)
      : { msg: payload == null ? '' : String(payload) })
  }
  try {
    // eslint-disable-next-line no-console
    console.log(tag, payload)
  } catch (e) {
    /* ignore */
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const prev = raw ? JSON.parse(raw) : []
    const next = Array.isArray(prev) ? prev : []
    next.push(row)
    while (next.length > MAX_ROWS) next.shift()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (e) {
    /* quota / private mode */
  }
}

/** 点击瞬间 UI 遮罩/可见性快照（第二下「点不动」常是 MessageBox 挡点击） */
export function uiBlockSnap() {
  try {
    const box = document.querySelector('.el-overlay.is-message-box, .el-overlay.is-message-box')
    const msgEl = document.querySelector('.el-message-box__message')
    const loading = document.querySelector('.el-loading-mask')
    return {
      hidden: !!(typeof document !== 'undefined' && document.hidden),
      hasMessageBox: !!(box && box.offsetParent !== null) || !!document.querySelector('.el-message-box'),
      messageBoxText: msgEl ? String(msgEl.textContent || '').slice(0, 80) : '',
      hasLoadingMask: !!loading,
      overlayCount: document.querySelectorAll('.el-overlay').length
    }
  } catch (e) {
    return { err: String(e) }
  }
}

function pushHb(lagMs, hidden) {
  try {
    const raw = sessionStorage.getItem(HB_KEY)
    const prev = raw ? JSON.parse(raw) : []
    const next = Array.isArray(prev) ? prev : []
    next.push({ t: Date.now(), lagMs: Math.round(lagMs), hidden: !!hidden })
    while (next.length > MAX_HB) next.shift()
    sessionStorage.setItem(HB_KEY, JSON.stringify(next))
  } catch (e) {
    /* ignore */
  }
}

/** 主线程心跳：仅在前台页计 lag；后台 60s 节流不算卡死 */
export function startConvClickHeartbeat() {
  if (typeof window === 'undefined') return
  if (window.__workchatConvHbStarted) return
  window.__workchatConvHbStarted = true
  let expected = Date.now() + 500
  const tick = () => {
    const now = Date.now()
    const hidden = typeof document !== 'undefined' && document.hidden
    if (hidden) {
      expected = now + 500
      pushHb(0, true)
      window.__workchatConvHbTimer = setTimeout(tick, 500)
      return
    }
    const lag = Math.max(0, now - expected)
    pushHb(lag, false)
    if (lag > 800) {
      convDiag('[hb] main-thread lag', { lagMs: lag, ...uiBlockSnap() })
    }
    expected = now + 500
    window.__workchatConvHbTimer = setTimeout(tick, 500)
  }
  window.__workchatConvHbTimer = setTimeout(tick, 500)
}

export function dumpConvClickDiag() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    const hbRaw = sessionStorage.getItem(HB_KEY)
    const hb = hbRaw ? JSON.parse(hbRaw) : []
    return {
      rows: Array.isArray(list) ? list : [],
      hb: Array.isArray(hb) ? hb : [],
      ui: uiBlockSnap(),
      dumpedAt: Date.now()
    }
  } catch (e) {
    return { rows: [], hb: [], dumpedAt: Date.now(), err: String(e) }
  }
}

/** 只保留标量，禁止深拷贝大对象 */
function sanitizeLight(obj) {
  const out = {}
  Object.keys(obj).forEach((k) => {
    const v = obj[k]
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = typeof v === 'string' && v.length > 120 ? v.slice(0, 120) : v
    } else if (Array.isArray(v)) {
      out[k] = `[${v.length}]`
    } else {
      out[k] = typeof v
    }
  })
  return out
}

if (typeof window !== 'undefined') {
  startConvClickHeartbeat()
  window.__dumpConvClickDiag = dumpConvClickDiag
  window.__printConvClickDiag = () => {
    const data = dumpConvClickDiag()
    // eslint-disable-next-line no-console
    console.log('[conv-diag] dump:\n' + JSON.stringify(data, null, 2))
    return data
  }
}
