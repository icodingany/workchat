/**
 * 设备检测工具
 * <p>
 * 检测当前运行环境是否为移动端，并提供设备类型供 WebSocket 认证使用。
 * 支持：UA 检测、URL 参数 ?mobile=1 预览模式、localStorage 持久化。
 */

const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
const FORCE_MOBILE_KEY = 'WORKCHAT_FORCE_MOBILE'

function isLocalPreviewHost() {
  if (typeof window === 'undefined' || !window.location) return false
  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function canUseMobilePreviewOverride() {
  const envMode = typeof process !== 'undefined' && process.env && process.env.NODE_ENV
  return envMode !== 'production' || isLocalPreviewHost()
}

function hasMobilePreviewOverride() {
  if (!canUseMobilePreviewOverride() || typeof window === 'undefined') return false

  try {
    const href = window.location && window.location.href ? window.location.href : ''
    const urlFlag = href.match(/(?:[?&#])(mobile|forceMobile|wc_mobile)=(1|true|0|false)(?:[&#]|$)/i)
    if (urlFlag) {
      const enabled = urlFlag[2] === '1' || urlFlag[2].toLowerCase() === 'true'
      if (window.localStorage) {
        if (enabled) {
          window.localStorage.setItem(FORCE_MOBILE_KEY, '1')
        } else {
          window.localStorage.removeItem(FORCE_MOBILE_KEY)
        }
      }
      return enabled
    }
  } catch (error) {
    /* ignore */
  }

  try {
    const storedFlag = window.localStorage && window.localStorage.getItem(FORCE_MOBILE_KEY)
    if (storedFlag === '1' || storedFlag === 'true') return true
  } catch (error) {
    /* ignore */
  }

  return false
}

/**
 * 检测 User-Agent 是否为移动端
 * @returns {boolean}
 */
export function isMobileUserAgent() {
  return typeof navigator !== 'undefined' && MOBILE_UA_RE.test(navigator.userAgent || '')
}

/**
 * 检测当前是否为移动端（UA + 预览模式）
 * @returns {boolean}
 */
export function isMobile() {
  if (isMobileUserAgent()) {
    return true
  }
  return hasMobilePreviewOverride()
}

/**
 * 获取 WebSocket DeviceAuth 的设备类型
 * - pc: 桌面浏览器 Web
 * - pc_desktop: Windows/Electron/Tauri
 * - mobile_web: 手机浏览器 H5 / 移动端预览
 * - mobile_app: 原生 App（Capacitor Android/iOS）
 * @returns {string}
 */
export function getWebSocketDeviceType() {
  // Capacitor 8 exposes window.Capacitor; older app shells use custom globals.
  if (typeof window !== 'undefined') {
    const capacitor = window.Capacitor || window.__CAPACITOR__ || window.WorkchatCapacitor
    if (
      capacitor &&
      (typeof capacitor.isNativePlatform !== 'function' || capacitor.isNativePlatform())
    ) {
      return 'mobile_app'
    }
  }

  if (isMobile()) {
    return 'mobile_web'
  }

  const mode = typeof process !== 'undefined' && process.env && process.env.VUE_APP_CURRENTMODE
  if (mode === 'tauri' || mode === 'electron') {
    return 'pc_desktop'
  }

  if (typeof navigator !== 'undefined' && /Electron\//i.test(navigator.userAgent)) {
    return 'pc_desktop'
  }

  return 'pc'
}