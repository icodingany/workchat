/** 桌面壳模式：electron（过渡期）与 tauri（目标） */
const DESKTOP_MODES = new Set(['electron', 'tauri'])

export function isDesktopMode(mode) {
  return DESKTOP_MODES.has(mode)
}

export function isDesktopBuild() {
  return isDesktopMode(process.env.VUE_APP_CURRENTMODE)
}
