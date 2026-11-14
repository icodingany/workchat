export const ALLOWED_IPC_CHANNELS = new Set([
  'operations',
  'check-for-updates',
  'check-for-updates-silent',
  'quit-and-install',
  'open-external-url',
  'updater-event'
])

function assertAllowedChannel(channel) {
  if (!ALLOWED_IPC_CHANNELS.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`)
  }
}

/**
 * @param {{ invoke: Function, listen: Function }} deps
 * @returns {{ ipcRenderer: object, shell: { openExternal: Function } }}
 */
export function createDesktopBridge(deps) {
  const { invoke, listen } = deps
  const updaterListeners = new Set()

  // P0：updater-event 预留 listen；P3 再接真实事件
  listen('updater-event', (payload) => {
    updaterListeners.forEach((cb) => cb({}, payload))
  }).catch(() => {})

  const ipcRenderer = {
    send(channel, ...args) {
      assertAllowedChannel(channel)
      if (channel === 'operations') {
        const op = args[0]
        invoke('desktop_operation', { op: String(op || '') })
        return
      }
      if (channel === 'check-for-updates' || channel === 'check-for-updates-silent') {
        invoke('check_for_updates', { silent: channel.endsWith('silent') })
        return
      }
      if (channel === 'quit-and-install') {
        invoke('quit_and_install')
        return
      }
      throw new Error(`IPC send not implemented for channel: ${channel}`)
    },
    invoke(channel, ...args) {
      assertAllowedChannel(channel)
      if (channel === 'open-external-url') {
        return invoke('open_external_url', { url: args[0] })
      }
      return invoke(channel, args[0])
    },
    on(channel, callback) {
      assertAllowedChannel(channel)
      if (channel === 'updater-event') {
        updaterListeners.add(callback)
        return () => updaterListeners.delete(callback)
      }
      return () => {}
    },
    once(channel, callback) {
      assertAllowedChannel(channel)
      const off = ipcRenderer.on(channel, (event, ...rest) => {
        off()
        callback(event, ...rest)
      })
    },
    removeListener(channel, listener) {
      assertAllowedChannel(channel)
      if (channel === 'updater-event') updaterListeners.delete(listener)
    },
    removeAllListeners(channel) {
      assertAllowedChannel(channel)
      if (channel === 'updater-event') updaterListeners.clear()
    }
  }

  return {
    ipcRenderer,
    shell: {
      openExternal: (url) => invoke('open_external_url', { url })
    }
  }
}

/** 在 Tauri 窗口安装 window.electronAPI（名称保留以兼容现有调用） */
export async function installTauriDesktopBridge() {
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const api = createDesktopBridge({
    invoke: (cmd, args) => invoke(cmd, args || {}),
    listen: (event, handler) => listen(event, (e) => handler(e.payload))
  })
  window.electronAPI = api
  return api
}

export function isTauriRuntime() {
  return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__)
}
