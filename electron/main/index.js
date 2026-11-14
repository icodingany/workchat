'use strict'

/**
 * workchat Electron 主进程入口（electron-vite / Electron 43）
 *
 * 由 electron-vite 编译，产物在 out/main/index.js（package.json main 字段指向它）。
 * 本文件相对 require 的 helper（updaterConfig/updaterInstall/updaterErrors）会被
 * pack-win.js 一并拷到 out/main/，故用 ./ 相对路径。
 *
 * 安全模型（对齐 kelailaichatpc）：
 *   - nodeIntegration: false、contextIsolation: true
 *   - 渲染进程不直接拿 electron API，全部走 preload 暴露的 window.electronAPI
 *   - IPC 通道走 operations / check-for-updates / quit-and-install / updater-event
 */

import { app, protocol, ipcMain, BrowserWindow, screen, globalShortcut, Menu, Tray, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'

const { ensureAppUpdateConfig, DEFAULT_FEED_URL } = require('./updaterConfig')
const { resolveDownloadedInstallerPath, spawnInstallerAndQuit } = require('./updaterInstall')
const { formatUpdaterError } = require('./updaterErrors')

const isDevelopment = process.env.NODE_ENV !== 'production'

let autoUpdater = null
if (!isDevelopment) {
    try {
        autoUpdater = require('electron-updater').autoUpdater
    } catch (e) {
        console.warn('[autoUpdater] electron-updater unavailable:', e && e.message ? e.message : e)
    }
}

function sendUpdaterEvent(payload) {
    if (win && win.webContents) {
        win.webContents.send('updater-event', payload)
    }
}

function performQuitAndInstall() {
    if (!autoUpdater) return
    const src = resolveDownloadedInstallerPath({
        downloadedUpdateHelper: autoUpdater.downloadedUpdateHelper,
        localAppData: process.env.LOCALAPPDATA
    })
    if (src) {
        const result = spawnInstallerAndQuit({
            srcPath: src,
            quitFn: () => app.quit(),
            openPathFn: (p) => shell.openPath(p),
            logFn: (line) => console.log(line)
        })
        if (result && result.ok) return
    }
    try {
        autoUpdater.quitAndInstall(false, true)
    } catch (e) {
        console.warn('[autoUpdater] quitAndInstall failed:', e && e.message ? e.message : e)
    }
}

function setupAutoUpdater() {
    if (!autoUpdater) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false
    if (typeof autoUpdater.disableDifferentialDownload !== 'undefined') {
        autoUpdater.disableDifferentialDownload = true
    }

    try {
        const ensured = ensureAppUpdateConfig({
            resourcesPath: process.resourcesPath,
            userDataPath: app.getPath('userData'),
            feedUrl: DEFAULT_FEED_URL,
            setUpdateConfigPath: (p) => {
                autoUpdater.updateConfigPath = p
            }
        })
        console.log('[autoUpdater] app-update.yml path=' + ensured.path + (ensured.created ? ' (created)' : ''))
    } catch (e) {
        console.warn('[autoUpdater] ensure app-update.yml failed:', e && e.message ? e.message : e)
    }

    autoUpdater.on('update-available', (info) => sendUpdaterEvent({ type: 'update-available', info }))
    autoUpdater.on('update-not-available', (info) => sendUpdaterEvent({ type: 'update-not-available', info }))
    autoUpdater.on('download-progress', (progress) => sendUpdaterEvent({ type: 'download-progress', progress }))
    autoUpdater.on('update-downloaded', (info) => sendUpdaterEvent({ type: 'update-downloaded', info }))
    autoUpdater.on('error', (err) => {
        const formatted = formatUpdaterError(err)
        sendUpdaterEvent({ type: 'error', message: formatted.tip, code: formatted.code })
    })

    ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdates().catch(() => {}))
    ipcMain.on('check-for-updates-silent', () => autoUpdater.checkForUpdates().catch(() => {}))
    ipcMain.on('quit-and-install', () => performQuitAndInstall())

    // 外链打开：渲染层 shell.openExternal 经此通道，主进程侧可加 host 白名单/确认框（暂直接转发）
    ipcMain.handle('open-external-url', async (_event, url) => {
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
        try {
            await shell.openExternal(url)
            return true
        } catch (e) {
            console.warn('[main] openExternal failed:', e && e.message)
            return false
        }
    })

    // 启动后延迟检查，避免抢占首屏
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {})
    }, 8000)
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win = null
let size = null
let appTray = null
let count = 0
let timer = null
let trayIconImage = null
let trayEmptyIconImage = null

function resolveExistingIconPath(candidates) {
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p
    }
    return ''
}

function loadTrayIcons() {
    const appIconPath = resolveExistingIconPath([
        path.resolve(process.cwd(), 'public/app.ico'),
        path.resolve(__dirname, 'app.ico'),
        path.resolve(__dirname, '../public/app.ico')
    ])
    const emptyIconPath = resolveExistingIconPath([
        path.resolve(process.cwd(), 'public/empty.ico'),
        path.resolve(__dirname, 'empty.ico'),
        path.resolve(__dirname, '../public/empty.ico'),
        appIconPath
    ])
    trayIconImage = appIconPath ? nativeImage.createFromPath(appIconPath) : nativeImage.createEmpty()
    trayEmptyIconImage = emptyIconPath ? nativeImage.createFromPath(emptyIconPath) : nativeImage.createEmpty()
}

function currentTrayMainIcon() {
    return trayIconImage && !trayIconImage.isEmpty() ? trayIconImage : ''
}

function currentTrayEmptyIcon() {
    return trayEmptyIconImage && !trayEmptyIconImage.isEmpty() ? trayEmptyIconImage : currentTrayMainIcon()
}

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
])

/**
 * 注册 app:// 自定义协议，从 electron-vite 渲染产物 out/renderer 提供静态文件。
 * Electron 43 用 protocol.handle（基于 Fetch Request/Response，替代废弃的 registerBufferProtocol）。
 * SPA history 路由 fallback 到 index.html（file:// + history 路由会白屏）。
 */
function registerAppProtocol() {
    const rendererRoot = path.join(__dirname, '../renderer')
    const mimeByExt = {
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.html': 'text/html',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.mp3': 'audio/mpeg',
        '.txt': 'text/plain'
    }
    protocol.handle('app', async (request) => {
        let pathName = new URL(request.url).pathname
        pathName = decodeURI(pathName)
        if (pathName === '/' || pathName === '') pathName = '/index.html'
        const filePath = path.normalize(path.join(rendererRoot, pathName.replace(/^\//, '')))
        // 路径穿越防护
        if (!filePath.startsWith(rendererRoot)) {
            return new Response('Forbidden', { status: 403 })
        }
        try {
            const data = await fs.promises.readFile(filePath)
            const mimeType = mimeByExt[path.extname(pathName).toLowerCase()] || ''
            const headers = mimeType ? { 'Content-Type': mimeType } : undefined
            return new Response(data, { status: 200, headers })
        } catch (error) {
            // SPA history 路由 fallback：无扩展名的路径返回 index.html 让 Vue Router 接管
            const ext = path.extname(pathName).toLowerCase()
            if (!ext || ext === '.html') {
                try {
                    const indexData = await fs.promises.readFile(path.join(rendererRoot, 'index.html'))
                    return new Response(indexData, { status: 200, headers: { 'Content-Type': 'text/html' } })
                } catch (_) {
                    /* index.html 也读不到，走 404 */
                }
            }
            console.error(`[app://] Failed to read ${filePath}`, error)
            return new Response('Not Found', { status: 404 })
        }
    })
}

function createWindow() {
    const appIconPath = resolveExistingIconPath([
        path.resolve(process.cwd(), 'public/app.ico'),
        path.resolve(__dirname, 'app.ico')
    ])
    win = new BrowserWindow({
        width: 700,
        height: 415,
        icon: appIconPath || undefined,
        frame: false,
        transparent: true,
        resizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: false, // 安全：禁用直接 Node.js 访问
            contextIsolation: true, // 安全：启用上下文隔离
            preload: path.join(__dirname, '../preload/index.js'),
            autoplayPolicy: 'no-user-gesture-required'
        }
    })

    // electron-vite 开发：ELECTRON_RENDERER_URL；打包/预览：app://（勿用 loadFile/file://，history 路由会白屏）
    if (process.env.ELECTRON_RENDERER_URL) {
        win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        registerAppProtocol()
        win.loadURL('app://./index.html')
    }

    win.on('closed', () => {
        win = null
    })

    // 监听 renderer 发来的信息（window 操作 + 截屏）
    ipcMain.on('operations', function (event, arg) {
        // 登陆后的窗口大小
        const width = size.width * 0.65 > 1150 ? size.width * 0.65 : 1150
        const height = size.height * 0.7 > 735 ? size.height * 0.7 : 735
        // 屏幕的大小
        const bw = size.width
        const bh = size.height
        switch (arg) {
            case 'newMsg': {
                // 菜单栏闪烁
                win.flashFrame(true)
                // 任务栏 闪烁
                if (!win.isVisible() && !timer) {
                    timer = setInterval(function () {
                        count++
                        if (count % 2 === 0) {
                            appTray.setImage(currentTrayEmptyIcon())
                        } else {
                            appTray.setImage(currentTrayMainIcon())
                        }
                    }, 500)
                }
                break
            }
            case 'exit':
                app.quit()
                break
            case 'login':
                win.setSize(width, height)
                win.center()
                break
            case 'logout': {
                const x = parseInt((bw - 700) / 2, 10)
                const y = parseInt((bh - 415) / 2, 10)
                win.setBounds({ x: x, y: y, width: 700, height: 415 })
                break
            }
            case 'min':
                win.minimize()
                break
            case 'max': {
                // 最大化或者还原
                const currentWindow = win.getContentBounds()
                const cw = currentWindow.width
                const x = parseInt((bw - width) / 2, 10)
                const y = parseInt((bh - height) / 2, 10)
                if (cw >= bw) {
                    // 还原
                    win.setBounds({ x: x, y: y, width: width, height: height })
                } else {
                    // 最大化
                    win.setSize(bw, bh)
                    win.center()
                }
                break
            }
            case 'hidden':
                win.hide()
                break
            case 'screencap': {
                // 截屏：调外部的 PrintScr.exe，成功后粘贴到 webContents
                const cmdPath =
                    process.env.NODE_ENV === 'development'
                        ? path.resolve(process.cwd(), 'public/screen/PrintScr.exe')
                        : path.join(__dirname, 'screen/PrintScr.exe')
                if (!fs.existsSync(cmdPath)) {
                    console.warn('[screencap] Optional capture helper is not installed; use system capture and paste.')
                    break
                }
                const screenWindow = execFile(cmdPath)
                screenWindow.on('error', (error) => {
                    console.warn('[screencap] Capture helper failed:', error.message)
                })
                screenWindow.on('exit', function (code) {
                    // 执行成功返回 1，返回 0 没有截图
                    if (code) {
                        win.webContents.paste()
                    }
                })
                break
            }
            default:
                break
        }
    })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})

// This method will be called when Electron has finished initialization.
app.whenReady().then(() => {
    size = screen.getPrimaryDisplay().workAreaSize
    createWindow()
    if (process.platform === 'win32') {
        loadTrayIcons()
        appTray = new Tray(currentTrayMainIcon())
        appTray.setToolTip('客服系统')

        const trayMenuTemplate = [
            {
                label: '退出',
                click: () => {
                    app.quit()
                    app.quit() // 关闭设为最小化时调用两次，防止最大化时一次关不掉
                }
            }
        ]
        const contextMenu = Menu.buildFromTemplate(trayMenuTemplate)
        appTray.setContextMenu(contextMenu)

        // 单击托盘图标显示/隐藏应用
        appTray.on('click', () => {
            win.isVisible() ? win.hide() : win.show()
            if (timer) {
                clearInterval(timer)
                timer = null
                count = 0
                appTray.setImage(currentTrayMainIcon())
            }
        })

        appTray.on('right-click', () => {
            appTray.popUpContextMenu(contextMenu)
        })
    }
    // 注册快捷键 ctrl + shift + l 打开调试窗口
    globalShortcut.register('CommandOrControl+Shift+L', () => {
        const focusWin = BrowserWindow.getFocusedWindow()
        focusWin && focusWin.toggleDevTools()
    })
    // 禁止 F5 刷新
    globalShortcut.register('F5', () => false)
    setupAutoUpdater()
})

// 恢复 F5 刷新
app.on('will-quit', () => {
    globalShortcut.unregister('F5')
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                app.quit()
            }
        })
    } else {
        process.on('SIGTERM', () => {
            app.quit()
        })
    }
}
