import { isSsoEmbedded } from './ssoEmbedded'
import { isWechatOnline } from './wechat'
import store from '@/store'
import {
  TriggerConversationPushTask,
  TriggerContactPushTask,
  TriggerCustomerPushTask
} from '@/api/webSocketApi'

/**
 * 客徕徕内嵌企微（iframe）postMessage 桥（企微/workchat 侧）。
 *
 * 宿主（客徕徕）把企微页嵌进 iframe 后：
 * - 宿主发 `wecom-bridge-handshake` → 本端回 `wecom-bridge-wechats`（企微账号列表）
 * - 宿主发 `wecom-bridge-select`    → 本端切换当前账号（对齐 AsidePage.choseWechat 全套联动）
 * - 账号列表变化（握手后）主动推送 `wecom-bridge-wechats`
 * - 内嵌态无 AsidePage 自动选中：列表到达且无当前号时自动选中第一个在线号
 *
 * 安全：仅当处于 iframe 且为 SSO 内嵌会话时激活；只接受客徕徕白名单域名的消息，
 * 回包只发往消息来源 origin。内嵌态下本端隐藏自有顶栏/账号栏（见 App.vue），
 * 账号切换由宿主列表驱动。
 */

// 宿主白名单：与 docs/deployment/iframe-embed-frame-ancestors.md 的 frame-ancestors 对齐
export const ALLOWED_PARENT_ORIGINS = [
  'https://example.invalid',
  'https://www.example.invalid',
  'https://test.example.invalid',
  'http://localhost:8088',
  'http://localhost:5173'
]

let initialized = false
let handshaked = false
const prefetchAt = {}

export function sanitizeWechats(wechats) {
  return (wechats || []).map((w) => ({
    WxId: w.WxId,
    WeChatNick: w.WeChatNick,
    Avatar: w.Avatar || '',
    IsOnline: isWechatOnline(w)
  }))
}

function buildWechatsMsg(store, wechatsOverride) {
  const wechats =
    wechatsOverride ||
    store.getters['conversation/wechats'] ||
    store.state.conversation.wechats ||
    []
  return {
    type: 'wecom-bridge-wechats',
    wechats: sanitizeWechats(wechats),
    currentWxId: currentWxIdOf(store)
  }
}

function sendWechats(win, store, origin, wechatsOverride) {
  win.postMessage(buildWechatsMsg(store, wechatsOverride), origin)
}

function currentWxIdOf(store) {
  return (store.state.conversation.currentWechat && store.state.conversation.currentWechat.WxId) || ''
}

// 对齐 AsidePage.choseWechat：始终写入当前号并拉客户/通讯录
function selectWechat(store, wechat) {
  store.commit('conversation/SET_CURRENT_WECHAT', wechat)
  store.dispatch('conversation/SetCurrentCustomers', wechat.WxId)
  store.dispatch('conversation/SetCurrentContacts', wechat.WxId)
  prefetchWechat(store, wechat.WxId)
}

function handleSelect(win, store, origin, wxId) {
  const wechats = store.state.conversation.wechats || []
  const wechat = wechats.find((w) => w && w.WxId === wxId)
  if (!wechat || !isWechatOnline(wechat)) {
    win.postMessage({ type: 'wecom-bridge-select-failed', wxId }, origin)
    return
  }
  selectWechat(store, wechat)
}

// 对齐 AsidePage.prefetchWechat：HTTP 镜像先出列表，再 Trigger 手机端拉最新
function prefetchWechat(store, wxId) {
  if (!wxId) return
  const key = String(wxId)
  const now = Date.now()
  if (now - (prefetchAt[key] || 0) < 3000) return
  prefetchAt[key] = now
  TriggerConversationPushTask(wxId)
  store
    .dispatch('conversation/LoadConversationSnapshot', { wxId, maxRecords: 300 })
    .catch(() => {})
  TriggerContactPushTask(wxId)
  TriggerCustomerPushTask(wxId)
}

/**
 * @param {Object} [deps] 测试注入 { win, store }
 */
export function initWecomEmbedBridge(deps = {}) {
  const win = deps.win || window
  const st = deps.store || store
  if (initialized) return
  if (win.parent === win.self) return // 非 iframe，独立打开
  if (!isSsoEmbedded()) return // 仅 SSO 内嵌会话激活
  initialized = true
  const state = { lastOrigin: '' }

  win.addEventListener('message', (event) => {
    if (!ALLOWED_PARENT_ORIGINS.includes(event.origin)) return
    const data = event.data || {}
    if (data.type === 'wecom-bridge-handshake') {
      handshaked = true
      state.lastOrigin = event.origin
      sendWechats(win, st, event.origin)
    } else if (data.type === 'wecom-bridge-select') {
      handleSelect(win, st, event.origin, data.wxId)
    }
  })

  // 握手后账号列表变化主动推送（回握手时的宿主 origin）。
  // 内嵌态 AsidePage 不渲染、其 wechatsOnline 自动选中不执行：列表到达且尚无
  // 当前号时在此选中第一个在线号，避免从宿主「企微」Tab 直进时会话区永远空白。
  if (st.watch) {
    st.watch(
      () => (st.getters && st.getters['conversation/wechats']) || st.state.conversation.wechats,
      (newVal) => {
        const wechats = newVal || []
        if (!currentWxIdOf(st)) {
          const online = wechats.find((w) => w && isWechatOnline(w))
          if (online) selectWechat(st, online)
        }
        if (handshaked && state.lastOrigin) sendWechats(win, st, state.lastOrigin, newVal)
      }
    )
  }
}

/** 测试用：重置模块状态 */
export function resetWecomEmbedBridgeForTest() {
  initialized = false
  handshaked = false
}

export const _internal = { sanitizeWechats, ALLOWED_PARENT_ORIGINS }
