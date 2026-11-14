import store from '@/store'
import router from '@/router'
import { ElMessage as Message } from 'element-plus'
import { normalizeWxId } from '@/utils/wechat'
import { isDesktopBuild } from '@/utils/desktopMode'

/** 最近一次 DeviceAuth 成功的时间戳，用于 30s 窗口内忽略别处登录错误 */
let lastLoginSuccessTime = 0

// 上下线抖动检测：弱网反复上下线时合并为「网络异常」提示，减少「xxx 下线了」误报
const FLAP_WINDOW_MS = 2 * 60 * 1000
const FLAP_THRESHOLD = 3
const FLAP_NOTIFY_COOLDOWN_MS = 5 * 60 * 1000
const __statusEvents = new Map()
const __flapNotifyAt = new Map()

function recordStatusEvent(wechatId) {
  const now = Date.now()
  const events = __statusEvents.get(wechatId) || []
  events.push(now)
  const cutoff = now - FLAP_WINDOW_MS
  const recent = events.filter((t) => t >= cutoff)
  __statusEvents.set(wechatId, recent)
  return recent.length >= FLAP_THRESHOLD
}

function handleFlapping(wechatId, wechatName) {
  const isFlapping = recordStatusEvent(wechatId)
  if (!isFlapping) return false

  const now = Date.now()
  const lastAt = __flapNotifyAt.get(wechatId) || 0
  if (now - lastAt >= FLAP_NOTIFY_COOLDOWN_MS) {
    __flapNotifyAt.set(wechatId, now)
    Message({
      message: `${wechatName} 手机网络异常，请检查手机网络`,
      type: 'warning',
      duration: 5000,
      showClose: true
    })
  }
  return true
}

/** 获取最近一次登录成功时间 */
export function getLastLoginSuccessTime() {
  return lastLoginSuccessTime
}

// 登陆成功 ok
function deviceAuthRspHandler(message) {
  lastLoginSuccessTime = Date.now()
  const prevAccount = store.state.currentUser && store.state.currentUser.account
  let currentUser = Object.assign({}, message.Extra || {})
  // 对外只用 Kid，去掉数字 SupplierId（=cid）
  delete currentUser.SupplierId
  if (prevAccount) currentUser.account = prevAccount

  // 设置用户信息与 token（须在关闭 loading 之前，避免补登 watch 误判失败）
  store.commit('SET_USER', currentUser)
  store.commit('SET_WEBSOCKET_TOKEN', message.AccessToken)
  // 同步落盘 validateToken，保证 /user/** 等客户端接口在刷新后仍可鉴权（对齐 httpToken 模式）
  if (message.AccessToken && typeof localStorage !== 'undefined') {
    localStorage.setItem('validateToken', message.AccessToken)
  }
  try {
    sessionStorage.removeItem('autoDeviceAuthPending')
  } catch (e) {
    /* ignore */
  }
  // 隐藏登陆页面的loading
  store.commit('websocket/SET_LOGIN_LOADING', false)

  // 路由决策：交给 tryCompleteUnifiedLogin 统一处理。
  // 该 action 会按 adminInfo.type 决定进 admin（管理员）还是 client（操作员），
  // 并避免本 handler 抢先 RESET_UNIFIED_LOGIN 导致 HTTP 还没回来时无法决策。
  // 边界：如果 unifiedLogin 不在 pending（HTTP 没走过统一登录流程，
  // 比如 WS 自动重连场景），保留原 client 兜底，避免停留在 login。
  const wasPending = store.state.unifiedLogin && store.state.unifiedLogin.pending
  if (wasPending) {
    // 由 tryCompleteUnifiedLogin 决策 panel + 路由（含进聚合聊天）；勿在此抢跳
    store.dispatch('tryCompleteUnifiedLogin')
  } else {
    // 非统一登录（如管理端切客服端补登 / WS 重连）
    let handoffToModeSwitch = false
    try {
      handoffToModeSwitch = sessionStorage.getItem('wsAuthInProgress') === '1'
    } catch (e) {
      /* ignore */
    }
    store.commit('SET_CLIENT_OR_SERVER', 'client')
    // AppModeSwitch 正在切客服端：只落 token，勿抢先改 activePanel/路由（否则会与守卫来回跳）
    if (!handoffToModeSwitch) {
      store.commit('SET_ACTIVE_PANEL', 'client')
      const path = (store.state.route && store.state.route.path) || ''
      if (path === '/login' || path === '/') {
        router.replace({ path: '/conversation' }).catch(() => {})
      }
    }
  }

  // 如果是electron：经 preload 暴露的 window.electronAPI 调主进程（contextIsolation 下不能直接 require）
  if (isDesktopBuild() && window.electronAPI) {
    window.electronAPI.ipcRenderer.send('operations', 'login')
  }

  // 获取微信列表（HTTP 首屏 + WS 在线态补充；admin 不依赖会话列表）
  if (store.state.activePanel !== 'admin') {
    store.dispatch('conversation/FetchWechatsList')
    store.dispatch('websocket/GetWeChatsReq')
  }
}

// 微信下线通知处理 ok
// 本地更新信息
// 该接口不会立马通知 当发消息的时候会触发
function wwOfflineNoticeHandler(message) {
  const wxId = normalizeWxId(message.WxId !== undefined ? message.WxId : message.wxId)
  for (const wechat of store.getters['conversation/wechats']) {
    if (normalizeWxId(wechat.WxId) === wxId) {
      if (!handleFlapping(wxId, wechat.Name || wechat.WxId)) {
        Message({
          message: `${wechat.Name} 已下线！请检查手机端连接状态，或稍后刷新页面重试。`,
          type: 'error',
          duration: 5000,
          showClose: true
        })
      }
      store.commit('conversation/WECHAT_OFF_LINE', wxId)
      break
    }
  }
}

// 微信上线 上线后自动登陆
function wwOnlineNoticeHandler(message) {
  // 上线不弹 toast；仍记录抖动事件，供下线侧合并「网络异常」提示
  const wxId = normalizeWxId(message.WxId !== undefined ? message.WxId : message.wxId)
  if (wxId) {
    recordStatusEvent(wxId)
    store.dispatch('nedb/SetLuckMoneyMap')
    store.dispatch('nedb/SyncBackendLuckMoneyRefundState', wxId)
  }
  store.commit('conversation/WECHAT_ON_LINE', message)
}

export default {
  deviceAuthRspHandler,
  wwOfflineNoticeHandler,
  wwOnlineNoticeHandler,
  getLastLoginSuccessTime
}
