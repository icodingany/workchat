/**
 * workchat 主入口文件（Vue 3 + Vite）
 * <p>
 * 企业微信管理平台的入口配置，负责：
 * <ul>
 *   <li>创建并挂载 Vue 应用实例（createApp）</li>
 *   <li>注册插件（Element Plus、Vuex、Vue Router）</li>
 *   <li>注册全局过滤器（Vue3 已移除 filter，改为 globalProperties.$filters）</li>
 *   <li>配置 Electron 模式的全局变量</li>
 *   <li>挂载全局属性（axios、nedb、lodash）</li>
 * </ul>
 */
import { createApp } from 'vue'
import App from './App.vue'
// PWA 已停用：此引入用于「注销线上存量旧 Service Worker + 清空 Cache Storage」
import { bootstrapServiceWorkerCleanup } from './registerServiceWorker'
import { initVersionChecker } from './utils/versionChecker'
import './utils/convClickDiag'
import { isMobile, isMobileUserAgent } from '@/utils/deviceDetector'
import initSetMobileViewport from '@/utils/setMobileViewport'
import { createVantDialogApi } from '@/shims/vant-dialog'
import { createVantToastApi } from '@/shims/vant-toast'

// 引入整个 Element Plus 组件库（全量引入）
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// Element Plus 的图标（SVG 组件，用于 <el-icon><Search /></el-icon>）
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// element-plus 已移除 el-icon 字体；业务仍大量用 <i class="el-icon-*"> 和 icon="el-icon-*"，
// vendor 回 element-ui 2.x 的字体 + CSS 让其继续显示（兼容层会注册 icon prop 别名组件）
import './assets/element-icons/icon.css'
// element-ui → element-plus 兼容层：$message/$confirm 等 + el-icon prop 别名
import elementPlusCompat from './plugins/element-plus-compat'
// 注：已移除 default-passive-events —— 它强制 mousedown 为 passive，与 element-plus el-option
// 的 preventDefault 冲突，导致下拉选中报错（kelailaichatpc 已踩过同坑）。现代浏览器对 wheel/touch
// 已默认 passive，无需此库。
// 注：不再全局挂载 lodash 到 globalProperties._ —— Vue3 的 this._ 是内部代理对象，
// 业务需用 lodash 处逐文件 import { debounce } from 'lodash'。

import axios from 'axios'
import store from './store'
import router from './router'
import { setupSiblingTabKick } from './utils/wsSessionOwner'

import filters from './filters'
import nedb from './db/nedb'
import { isDesktopBuild } from './utils/desktopMode'
import { installTauriDesktopBridge, isTauriRuntime } from './desktop/bridge'

initSetMobileViewport()

if (process.env.NODE_ENV === 'development' && isMobile() && isMobileUserAgent()) {
  import('vconsole').then((module) => {
    const VConsole = module.default
    new VConsole()
  })
}

// 注册全局图标组件
const app = createApp(App)
let pendingVantInstall = null

for (const [iconName, iconComponent] of Object.entries(ElementPlusIconsVue)) {
  app.component(iconName, iconComponent)
}

// 应用插件
app.use(ElementPlus, { locale: zhCn })
app.use(elementPlusCompat) // 挂载 $message/$confirm/$alert/$notify/$loading 到 globalProperties
app.use(store)
app.use(router)

// e2e 注入通道：Playwright 用本地静态服务跑 dist 时暴露 store/router（生产域名不生效）
if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname || '')) {
  window.__workchat = { store, router }
}

/**
 * 挂载全局属性（Vue3 用 app.config.globalProperties 替代 Vue.prototype）
 */
app.config.globalProperties.$axios = axios // HTTP 请求库
app.config.globalProperties.$nedb = nedb // 本地数据库（IndexedDB 封装）

// Vue3 已删除 filter 全局注册；把过滤器挂到全局属性上，模板里用 $filters.xxx(x) 调用
app.config.globalProperties.$filters = filters

/**
 * 桌面壳配置（Electron / Tauri）
 * <p>
 * Tauri：先安装与 preload 同形的 window.electronAPI；再挂 $ipcRenderer。
 * Electron：preload 已暴露 electronAPI，直接挂载。
 */
async function setupDesktopShell(vueApp, vuexStore) {
  if (isTauriRuntime()) {
    await installTauriDesktopBridge()
  }
  if (!isDesktopBuild() || !window.electronAPI) return
  const mode = process.env.VUE_APP_CURRENTMODE === 'tauri' ? 'tauri' : 'electron'
  vuexStore.commit('SET_CURRENT_MODE', mode)
  vueApp.config.globalProperties.$ipcRenderer = window.electronAPI.ipcRenderer
  vueApp.config.globalProperties.$remote = {}
}

app.config.performance = process.env.NODE_ENV !== 'production'

/** 版本检查不阻塞首屏：挂载后再异步检查 */
function scheduleVersionCheck() {
  const run = () => initVersionChecker()
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 3000 })
  } else {
    setTimeout(run, 0)
  }
}

/** 版本检查不阻塞首屏：挂载后再异步检查 */
function postMount() {
  scheduleVersionCheck()
  // 注册多 Tab 互踢监听：其它 Tab 登录后本 Tab 退出
  setupSiblingTabKick(store, router)
}

function loadVantIfMobile() {
  if (!isMobile()) {
    return Promise.resolve()
  }
  return Promise.all([
    import('vant'),
    import('vant/lib/index.css')
  ]).then(([vantMod]) => {
    const install = (vueApp) => {
      const vant = vantMod.default || vantMod
      vueApp.use(vant)
      const {
        showToast,
        showFailToast,
        showSuccessToast,
        showLoadingToast,
        closeToast,
        showDialog,
        showConfirmDialog,
        closeDialog
      } = vantMod
      vueApp.config.globalProperties.$toast = createVantToastApi({
        showToast,
        showFailToast,
        showSuccessToast,
        showLoadingToast,
        closeToast
      })
      vueApp.config.globalProperties.$dialog = createVantDialogApi({
        showDialog,
        showConfirmDialog,
        closeDialog
      })
    }
    if (app._container) {
      install(app)
    } else {
      pendingVantInstall = install
    }
  })
}

/**
 * 先清理旧 SW（必要时会 reload 一次），再挂载，避免强刷仍被旧 SW 劫持。
 */
async function startApp() {
  const reloading = await bootstrapServiceWorkerCleanup()
  if (reloading) return
  try {
    await loadVantIfMobile()
  } catch (e) {
    console.warn('[main] Vant load skipped:', e)
  }
  await setupDesktopShell(app, store)
  if (pendingVantInstall) {
    pendingVantInstall(app)
    pendingVantInstall = null
  }
  app.mount('#app')
  postMount()
}

startApp().catch(async (e) => {
  console.warn('startApp failed, mount anyway', e)
  try {
    await loadVantIfMobile()
  } catch (vantErr) {
    console.warn('[main] Vant load skipped:', vantErr)
  }
  try {
    await setupDesktopShell(app, store)
  } catch (setupErr) {
    console.warn('setupDesktopShell failed', setupErr)
  }
  if (pendingVantInstall) {
    pendingVantInstall(app)
    pendingVantInstall = null
  }
  app.mount('#app')
  postMount()
})

export { app }
