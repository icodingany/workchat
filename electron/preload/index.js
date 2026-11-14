'use strict'

/**
 * workchat Electron preload（contextIsolation: true / nodeIntegration: false）
 *
 * 安全模型（对齐 kelailaichatpc）：
 *   1. 渲染进程只能通过 contextBridge 暴露的 electronAPI 访问主进程能力，不能直接拿 ipcRenderer。
 *   2. 所有 ipcRenderer 调用必须命中 ALLOWED_IPC_CHANNELS 白名单。
 *   3. shell.openExternal 走主进程 IPC（这里直接转 ipcRenderer.invoke，主进程侧可再加 host 白名单）。
 *
 * 渲染层调用方（迁移后）：
 *   - HeaderPage / admin / LoginPage / ToolsBar / previewHandle / msgHandler：operations 通道
 *   - utils/electronUpdater：check-for-updates / quit-and-install / updater-event
 *   - ShowChats：shell.openExternal（外链）
 */

const { contextBridge, ipcRenderer, shell } = require('electron')

// ============================================================================
// IPC 通道白名单
// ----------------------------------------------------------------------------
// 来源：渲染层实际调用点。任何新增 channel 必须先加入此 Set；
// 非白名单调用会抛错，便于发现未授权的 IPC 调用。
// ============================================================================
const ALLOWED_IPC_CHANNELS = new Set([
    // ---- send（window 操作 / 业务事件）----
    'operations', // newMsg/exit/login/logout/min/max/hidden/screencap
    // ---- send / invoke（自动更新）----
    'check-for-updates',
    'check-for-updates-silent',
    'quit-and-install',
    'open-external-url',
    // ---- on / once / removeListener（主进程→渲染进程）----
    'updater-event'
])

function assertAllowedChannel(channel) {
    if (!ALLOWED_IPC_CHANNELS.has(channel)) {
        throw new Error(`IPC channel not allowed: ${channel}`)
    }
}

/**
 * 安全的 IPC 代理：允许 invoke/on/send 但不直接暴露 ipcRenderer，且通道必须命中白名单
 */
const ipcProxy = {
    send: (channel, ...args) => {
        assertAllowedChannel(channel)
        ipcRenderer.send(channel, ...args)
    },
    invoke: (channel, ...args) => {
        assertAllowedChannel(channel)
        return ipcRenderer.invoke(channel, ...args)
    },
    on: (channel, callback) => {
        assertAllowedChannel(channel)
        // 与原生 ipcRenderer.on 语义一致：callback 收到 (event, ...args)
        const listener = (event, ...args) => callback(event, ...args)
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
    },
    once: (channel, callback) => {
        assertAllowedChannel(channel)
        const listener = (event, ...args) => callback(event, ...args)
        ipcRenderer.once(channel, listener)
    },
    removeListener: (channel, listener) => {
        assertAllowedChannel(channel)
        ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => {
        assertAllowedChannel(channel)
        ipcRenderer.removeAllListeners(channel)
    }
}

/**
 * 暴露到渲染进程的 API（window.electronAPI）
 */
const electronAPI = {
    ipcRenderer: ipcProxy,

    // Shell：外链打开。主进程 open-external-url 可再加 host 白名单 + 确认框（暂直接转发）
    shell: {
        openExternal: (url) => ipcRenderer.invoke('open-external-url', url)
    }
}

// 兼容渲染层旧代码的 ipcRenderer.send('operations', ...) 直接调用形式：
// 通过 contextBridge 顶层暴露一个收口，调用方优先用 electronAPI.ipcRenderer。
try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
} catch (e) {
    console.error('Failed to expose electronAPI:', e)
}

if (process.env.NODE_ENV === 'development') {
    console.log('[preload] electronAPI exposed successfully')
}
