/* eslint-disable no-console */
/**
 * Service Worker 自注销（PWA 关闭过渡方案）
 * 存量旧 SW 会导致强刷后仍拦请求 / 新旧资源错配，表现为「强刷没反应」或白屏。
 */
export async function cleanupLegacyServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    let cleared = registrations.length > 0

    await Promise.all(
      registrations.map((reg) =>
        reg.unregister().catch((e) => {
          console.warn('⚠️ Service Worker 注销失败:', e)
        })
      )
    )

    if ('caches' in window) {
      const keys = await caches.keys()
      if (keys.length) cleared = true
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    if (cleared) {
      console.log('✅ 已注销旧 Service Worker 并清空缓存（PWA 已停用）')
    }
    return cleared
  } catch (error) {
    console.warn('⚠️ 清理旧 Service Worker 失败:', error)
    return false
  }
}

/**
 * 启动：先清 SW。对齐 kelailaichatpc——仅当注销后仍被旧 SW 控制时才硬刷新；
 * 第 1 道防线（index.html 内联脚本）通常已清干净，此层退为兜底，避免无谓 reload 影响首屏。
 * @returns {Promise<boolean>} true 表示即将 reload，调用方勿再 mount
 */
function stillControlled() {
  return !!(navigator.serviceWorker && navigator.serviceWorker.controller)
}

export async function bootstrapServiceWorkerCleanup() {
  const FLAG = 'workchat_sw_cleaned_reload'
  try {
    // 内联脚本已标记本会话清理过、且已无 SW 控制 → 直接放行挂载
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('workchat_sw_clean_v2') === '1' && !stillControlled()) {
      return false
    }
    const hadBefore =
      stillControlled() ||
      (('serviceWorker' in navigator) && (await navigator.serviceWorker.getRegistrations()).length > 0)
    if (!hadBefore) {
      return false
    }
    await cleanupLegacyServiceWorker()
    // 注销后仍被旧 SW 控制（罕见，浏览器生命周期延迟）才带时间戳硬刷新；已清干净则继续挂载
    if (stillControlled() && typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(FLAG)) {
      sessionStorage.setItem(FLAG, '1')
      const url = new URL(location.href)
      url.searchParams.set('_cc', String(Date.now()))
      location.replace(url.toString())
      return true
    }
  } catch (e) {
    console.warn('⚠️ SW bootstrap 失败:', e)
  }
  return false
}
