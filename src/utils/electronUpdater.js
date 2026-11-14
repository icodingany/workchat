import { isDesktopBuild } from './desktopMode'

/**
 * 桌面壳自动更新（渲染进程）
 * Electron preload / Tauri bridge 均暴露 window.electronAPI.ipcRenderer。
 */

const IS_DESKTOP = isDesktopBuild()

function getIpcRenderer() {
  if (typeof window === 'undefined') return null
  try {
    const api = window.electronAPI
    return api && api.ipcRenderer ? api.ipcRenderer : null
  } catch (e) {
    return null
  }
}

let loginUpdateCheckSent = false

/** @deprecated 名称保留；语义为桌面壳（electron|tauri） */
export function isElectron() {
  return IS_DESKTOP
}

/** 静默检查更新（错误不弹框） */
export function checkElectronUpdateSilent() {
  const ipc = getIpcRenderer()
  if (!ipc) return
  ipc.send('check-for-updates-silent')
}

/** 用户主动检查 */
export function checkElectronUpdate() {
  const ipc = getIpcRenderer()
  if (!ipc) return
  ipc.send('check-for-updates')
}

export function checkElectronUpdateOnLogin() {
  if (!IS_DESKTOP) return
  if (loginUpdateCheckSent) return
  loginUpdateCheckSent = true
  checkElectronUpdateSilent()
}

export function resetElectronUpdateLoginCheck() {
  loginUpdateCheckSent = false
}

export function quitAndInstall() {
  const ipc = getIpcRenderer()
  if (!ipc) return
  ipc.send('quit-and-install')
}

/**
 * @param {(data: { type: string, info?: object, progress?: object, message?: string }) => void} callback
 * @returns {() => void}
 */
export function onUpdaterEvent(callback) {
  const ipc = getIpcRenderer()
  if (!ipc || typeof callback !== 'function') return () => {}
  const handler = (event, data) => callback(data)
  ipc.on('updater-event', handler)
  return () => {
    try {
      ipc.removeListener('updater-event', handler)
    } catch (e) {
      /* ignore */
    }
  }
}
