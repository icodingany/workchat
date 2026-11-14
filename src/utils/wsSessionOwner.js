/**
 * Web 端 WS 会话归属管理
 *
 * 解决多 Tab 登录互踢问题：
 * - 登录前 claim → localStorage 全局 id + sessionStorage 本 Tab id
 * - 其它 Tab 监听 storage 事件 → kickTabToLogin
 * - DeviceAuthReq credential 第四段 sessionOwnerId 与后端代际对齐
 */
const OWNER_KEY = 'workchat_ws_owner'
const SESSION_OWNER_KEY = 'workchat_ws_session_owner'

/** 获取当前 Tab 的会话归属 id */
export function getWsSessionOwnerId() {
  try {
    return sessionStorage.getItem(SESSION_OWNER_KEY) || ''
  } catch (_) {
    return ''
  }
}

/** DeviceAuthReq 前调用：声明当前 Tab 为最新 WS 会话 */
export function claimWsSessionOwner() {
  const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  try {
    localStorage.setItem(OWNER_KEY, id)
    sessionStorage.setItem(SESSION_OWNER_KEY, id)
  } catch (_) {
    /* ignore quota / private mode */
  }
  return id
}

/** 判断当前 Tab 是否仍是全局最新的 WS 会话 owner */
export function isCurrentWsSessionOwner() {
  try {
    const globalOwner = localStorage.getItem(OWNER_KEY)
    const sessionOwner = sessionStorage.getItem(SESSION_OWNER_KEY)
    // 无全局 owner 或本 Tab 无 sessionOwner（如 Electron 重启后 sessionStorage 清空），
    // 保守地认为是当前 owner，不阻断 WS 认证
    if (!globalOwner) return true
    if (!sessionOwner) return true
    return globalOwner === sessionOwner
  } catch (_) {
    return true
  }
}

/** 释放会话归属（退出登录时调用） */
export function releaseWsSessionOwnerIfHeld() {
  try {
    const globalOwner = localStorage.getItem(OWNER_KEY)
    const sessionOwner = sessionStorage.getItem(SESSION_OWNER_KEY)
    if (globalOwner && sessionOwner && globalOwner === sessionOwner) {
      localStorage.removeItem(OWNER_KEY)
    }
    sessionStorage.removeItem(SESSION_OWNER_KEY)
  } catch (_) {
    /* ignore */
  }
}

/** 被其它 Tab 挤下线：清登录态并回登录页 */
export function kickTabToLogin(store, router) {
  import('@/websocket/websocket').then(({ closeWebsocket }) => {
    closeWebsocket()
    store.commit('SET_WEBSOCKET_TOKEN', '')
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('validateToken')
      localStorage.removeItem('httpToken')
      localStorage.removeItem('adminInfo')
    }
    store.commit('SET_ADMIN_INO', {})
    store.commit('SET_HTTP_TOKEN', '')
    const name = router && router.currentRoute && router.currentRoute.name
    if (name && name !== 'login') {
      router.replace({ name: 'login' }).catch(() => {})
    }
  })
}

/** main.js 注册：其它 Tab claim 后本 Tab 退出 */
export function setupSiblingTabKick(store, router) {
  if (typeof window === 'undefined') return
  window.addEventListener('storage', (e) => {
    if (e.key !== OWNER_KEY || !e.newValue) return
    if (isCurrentWsSessionOwner()) return
    console.log('[wsSessionOwner] 其它 Tab 已登录，本 Tab 退出')
    kickTabToLogin(store, router)
  })
}