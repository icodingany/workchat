import { isDesktopBuild } from './desktopMode'

/**
 * Web 发版后自动硬刷新（对齐 kelailaichatpc）
 * <p>
 * 构建产出 version.json（YYYYMMDDHHmm），运行时对比 localStorage.app_version
 * 与 bundle 内 process.env.VERSION；不一致则清 SW/Cache 并带 ?_cc= 硬刷新。
 * 桌面壳（electron/tauri）/ localhost 跳过。
 */

/** sessionStorage：同一服务端版本最多硬刷新一次，防止循环 reload */
const SESSION_RELOAD_FOR_VERSION = 'workchat_web_hard_reload_for'

/** 带时间戳的硬刷新，绕过磁盘缓存 */
export function hardReloadBypassCache() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('_cc', String(Date.now()))
  window.location.replace(url.toString())
}

function hasAlreadyHardReloadedForVersion(serverVersion) {
  try {
    return sessionStorage.getItem(SESSION_RELOAD_FOR_VERSION) === String(serverVersion)
  } catch (_) {
    return false
  }
}

function markHardReloadForVersion(serverVersion) {
  try {
    sessionStorage.setItem(SESSION_RELOAD_FOR_VERSION, String(serverVersion))
  } catch (_) {}
}

/** 当前运行 bundle 的构建版本（与 version.json 同源） */
export function getRunningBundleVersion() {
  try {
    return process.env.VERSION != null && String(process.env.VERSION).trim() !== ''
      ? String(process.env.VERSION).trim()
      : ''
  } catch (_) {
    return ''
  }
}

function isWebVersionCheckHost() {
  if (isDesktopBuild()) return false
  try {
    const host = typeof window !== 'undefined' && window.location ? window.location.hostname : ''
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
  } catch (_) {}
  return typeof window !== 'undefined'
}

/** 兼容 publicPath './'：相对当前页面目录取 version.json */
function getVersionJsonUrl() {
  try {
    const base = window.location.href.split('#')[0]
    const dir = base.endsWith('/') ? base : base.replace(/\/[^/]*$/, '/')
    return dir + 'version.json?t=' + Date.now()
  } catch (_) {
    return '/version.json?t=' + Date.now()
  }
}

/** 注销 Service Worker 并清空 Cache Storage */
export async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map((registration) =>
        registration.unregister().catch(() => {})
      )
    )
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch (error) {
    console.warn('[版本] 清除 Service Worker 失败:', error)
  }
}

/** 升级时轻量清除：仅 SW / Cache，保留 localStorage（登录态） */
export async function clearCachesForUpgrade() {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    }
    await unregisterServiceWorkers()
  } catch (error) {
    console.warn('[版本] 清除升级缓存失败:', error)
  }
}

/**
 * 全量清理（含登录态），仅 clearDataOnUpgrade=true 时使用。
 * 保留新版本号与「记住密码」字段。
 * @param {string|null} preserveVersion
 */
export async function deleteAllCaches(preserveVersion = null) {
  try {
    const appVersion = preserveVersion || localStorage.getItem('app_version') || ''
    const hardReloadForVersion = sessionStorage.getItem(SESSION_RELOAD_FOR_VERSION) || ''
    let rememberedName = ''
    let rememberedPwd = ''
    let rememberedFlag = ''
    try {
      rememberedName = localStorage.getItem('localNameOfJuboChat') || ''
      rememberedPwd = localStorage.getItem('localPwdOfJuboChat') || ''
      rememberedFlag = localStorage.getItem('remarkPwdOfJuboChat') || ''
    } catch (_) {}

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    }

    if ('localStorage' in window) {
      localStorage.clear()
      if (appVersion) {
        localStorage.setItem('app_version', appVersion)
      }
      if (rememberedName && rememberedPwd) {
        localStorage.setItem('localNameOfJuboChat', rememberedName)
        localStorage.setItem('localPwdOfJuboChat', rememberedPwd)
        localStorage.setItem('remarkPwdOfJuboChat', rememberedFlag || '1')
      }
    }

    if ('sessionStorage' in window) {
      sessionStorage.clear()
      if (hardReloadForVersion) {
        sessionStorage.setItem(SESSION_RELOAD_FOR_VERSION, hardReloadForVersion)
      }
    }

    await unregisterServiceWorkers()
  } catch (error) {
    console.error('[版本] 全量清除缓存失败:', error)
  }
}

let versionUpdateCheckRunning = false

/** 拉取 version.json，有新版本则硬刷新 */
export async function checkVersionUpdate() {
  if (!isWebVersionCheckHost()) return
  if (versionUpdateCheckRunning) return
  versionUpdateCheckRunning = true

  try {
    const response = await fetch(getVersionJsonUrl(), {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      }
    })

    if (!response.ok) {
      return
    }

    const versionInfo = await response.json()
    const currentVersion = String(versionInfo.version)
    const localVersion = localStorage.getItem('app_version')
    const bundleVersion = getRunningBundleVersion()
    const clearDataOnUpgrade = versionInfo.clearDataOnUpgrade === true
    const bundleBehindServer = !!bundleVersion && bundleVersion !== currentVersion

    if (sessionStorage.getItem('version_update_processing') === 'true') {
      return
    }

    // 首次访问只登记版本号，不清登录态
    if (!localVersion) {
      localStorage.setItem('app_version', currentVersion)
      return
    }

    if (String(localVersion) !== String(currentVersion) || bundleBehindServer) {
      if (hasAlreadyHardReloadedForVersion(currentVersion)) {
        if (String(localVersion) !== String(currentVersion)) {
          localStorage.setItem('app_version', currentVersion)
        }
        return
      }

      console.log(
        '[版本] 检测到更新:',
        localVersion,
        '->',
        currentVersion,
        bundleBehindServer ? `(bundle ${bundleVersion})` : ''
      )
      sessionStorage.setItem('version_update_processing', 'true')
      markHardReloadForVersion(currentVersion)

      if (clearDataOnUpgrade) {
        await deleteAllCaches(currentVersion)
      } else {
        await clearCachesForUpgrade()
      }
      localStorage.setItem('app_version', currentVersion)
      setTimeout(() => {
        sessionStorage.removeItem('version_update_processing')
        hardReloadBypassCache()
      }, 100)
      return
    }
  } catch (error) {
    console.warn('[版本] 版本检查失败:', error)
  } finally {
    versionUpdateCheckRunning = false
  }
}

let focusVersionCheckTimer = null

function scheduleFocusVersionCheck() {
  if (focusVersionCheckTimer) return
  focusVersionCheckTimer = setTimeout(() => {
    focusVersionCheckTimer = null
    checkVersionUpdate()
  }, 800)
}

/** 启动时检查；切回 Tab 时再查一次 */
export function initVersionChecker() {
  checkVersionUpdate()
  if (typeof document === 'undefined') return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleFocusVersionCheck()
    }
  })
}

export default {
  checkVersionUpdate,
  initVersionChecker,
  getRunningBundleVersion,
  deleteAllCaches,
  clearCachesForUpgrade,
  hardReloadBypassCache
}
