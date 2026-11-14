'use strict'

// Node 22 构建链注入的 flag，Electron 13 内置 Node 不支持
if (process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS
    .replace(/\s*--openssl-legacy-provider\b/g, '')
    .trim()
}

import { app, protocol, ipcMain, BrowserWindow, screen, globalShortcut, Menu, Tray, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
/* installVueDevtools */
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'

const isDevelopment = process.env.NODE_ENV !== 'production'

const { ensureAppUpdateConfig, DEFAULT_FEED_URL } = require('./electron/updaterConfig')
const { resolveDownloadedInstallerPath, spawnInstallerAndQuit } = require('./electron/updaterInstall')
const { formatUpdaterError } = require('./electron/updaterErrors')

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

    autoUpdater.on('update-available', (info) => {
        sendUpdaterEvent({ type: 'update-available', info })
    })
    autoUpdater.on('update-not-available', (info) => {
        sendUpdaterEvent({ type: 'update-not-available', info })
    })
    autoUpdater.on('download-progress', (progress) => {
        sendUpdaterEvent({ type: 'download-progress', progress })
    })
    autoUpdater.on('update-downloaded', (info) => {
        sendUpdaterEvent({ type: 'update-downloaded', info })
    })
    autoUpdater.on('error', (err) => {
        const formatted = formatUpdaterError(err)
        sendUpdaterEvent({ type: 'error', message: formatted.tip, code: formatted.code })
    })

    ipcMain.on('check-for-updates', () => {
        autoUpdater.checkForUpdates().catch(() => {})
    })
    ipcMain.on('check-for-updates-silent', () => {
        autoUpdater.checkForUpdates().catch(() => {})
    })
    ipcMain.on('quit-and-install', () => {
        performQuitAndInstall()
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
let timer = null;
let iconUrl = process.env.NODE_ENV === 'development' ? 'public/app.ico' : `${__dirname}/app.ico`;
let emptyUrl = process.env.NODE_ENV === 'development' ? 'public/empty.ico' : `${__dirname}/empty.ico`;
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
    trayIconImage = appIconPath ? nativeImage.createFromPath(appIconPath) : nativeImage.createFromPath(iconUrl)
    trayEmptyIconImage = emptyIconPath ? nativeImage.createFromPath(emptyIconPath) : nativeImage.createFromPath(emptyUrl)
}

function currentTrayMainIcon() {
    return trayIconImage && !trayIconImage.isEmpty() ? trayIconImage : iconUrl
}

function currentTrayEmptyIcon() {
    return trayEmptyIconImage && !trayEmptyIconImage.isEmpty() ? trayEmptyIconImage : currentTrayMainIcon()
}

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }])

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow(
        {
            width: 700, // 宽
            height: 415, // 高
            icon: iconUrl,
            frame: false, // 设置为 false 时可以创建一个无边框窗口
            transparent: true,
            resizable: false, // 窗口是否可以改变尺寸
            maximizable: false, // 禁止最大化
            // autoHideMenuBar:true,// 是否隐藏菜单栏
            // titleBarStyle:'hidden',// 窗口标题栏的样式
            // backgroundColor:'#fff',// 窗口的背景颜色为十六进制值
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                contextIsolation: false
            },
        }
    )

    // development 和 production 加载不同的地址
    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        // if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
        createProtocol('app')
        // Load the index.html when not in development
        win.loadURL('app://./index.html')
    }

    win.on('closed', () => {
        win = null
    })

    // 监听renderer发来的信息
    ipcMain.on('operations', function (event, arg) {
        // 登陆后的窗口大小
        let width = size.width * 0.65 > 1150 ? size.width * 0.65 : 1150
        let height = size.height * 0.7 > 735 ? size.height * 0.7 : 735
        // 屏幕的大小
        let bw = size.width
        let bh = size.height
        switch (arg) {
            case 'newMsg':
                {
                    // 菜单栏闪烁
                    win.flashFrame(true)
                    // 任务栏 闪烁
                    if (!win.isVisible() && !timer) {
                        timer = setInterval(function () {
                            count++;
                            if (count % 2 == 0) {
                                // appTray.setImage(path.join(trayIcon, 'empty.ico'))
                                appTray.setImage(currentTrayEmptyIcon())
                            } else {
                                appTray.setImage(currentTrayMainIcon())
                            }
                        }, 500);
                    }
                }
                break
            case 'exit':
                // app.exit()
                app.quit()
                break
            case 'login':
                win.setSize(width, height)
                win.center()
                break
            case 'logout':
                {
                    let x = parseInt((bw - 700) / 2, 10)
                    let y = parseInt((bh - 415) / 2, 10)
                    win.setBounds({ x: x, y: y, width: 700, height: 415 })
                    // app.relaunch()
                    // app.quit()
                }
                // app.exit()
                break
            case 'min':
                // 最小化
                win.minimize()
                break
            case 'max':
                {
                    // 最大化或者还原
                    // 当前窗口的大小
                    let currentWindow = win.getContentBounds()
                    let cw = currentWindow.width
                    // let ch = currentWindow.height
                    // 中心坐标
                    let x = parseInt((bw - width) / 2, 10)
                    let y = parseInt((bh - height) / 2, 10)
                    if (cw >= bw) {
                        // 还原
                        win.setBounds({ x: x, y: y, width: width, height: height })
                    } else {
                        // 最大化
                        win.setSize(bw, bh)
                        win.center()
                    }
                }
                break
            case 'hidden':
                // 隐藏窗口
                win.hide()
                break
            case 'screencap':
                {
                    let cmdPath = process.env.NODE_ENV === 'development' ? 'public/screen/PrintScr.exe' : `${__dirname}/screen/PrintScr.exe`;
                    // 和渲染进程通讯
                    // win.webContents.send('screencap', cmdPath)
                    // 截屏
                    const { execFile } = require('child_process');
                    const screen_window = execFile(cmdPath);
                    screen_window.on('exit', function (code) {
                        // 执行成功返回 1，返回 0 没有截图
                        if (code) {
                            win.webContents.paste()
                        }
                    })
                }
                break
            default:
                break
        }
    })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    // if (isDevelopment && !process.env.IS_TEST) {
        // Install Vue Devtools
        // Devtools extensions are broken in Electron 6.0.0 and greater
        // See https://github.com/nklayman/vue-cli-plugin-electron-builder/issues/378 for more info
        // Electron will not launch with Devtools extensions installed on Windows 10 with dark mode
        // If you are not using Windows 10 dark mode, you may uncomment these lines
        // In addition, if the linked issue is closed, you can upgrade electron and uncomment these lines
        // try {
        //   await installVueDevtools()
        // } catch (e) {
        //   console.error('Vue Devtools failed to install:', e.toString())
        // }

    // }
    size = screen.getPrimaryDisplay().workAreaSize
    createWindow()
    if (process.platform === 'win32') {
        loadTrayIcons()
        // 系统托盘图标
        appTray = new Tray(currentTrayMainIcon());
        //设置此托盘图标的悬停提示内容
        appTray.setToolTip('客服系统')

        //设置托盘图标和菜单
        let trayMenuTemplate = [
            // {
            //     label: '打开',
            //     click: () => {
            //         win.show();
            //     }
            // },
            {
                label: '退出',
                click: () => {
                    app.quit();
                    app.quit(); // 因为程序设定关闭为最小化，所以调用两次关闭，防止最大化时一次不能关闭的情况
                    // win.webContents.send('operations', 'exit')
                }
            }
        ];
        // 图标的上下文菜单
        const contextMenu = Menu.buildFromTemplate(trayMenuTemplate)
        // 设置此图标的上下文菜单
        appTray.setContextMenu(contextMenu)

        // 单击右下角小图标显示应用左键
        appTray.on('click', () => {
            win.isVisible() ? win.hide() : win.show()
            // 不闪烁
            if (timer) {
                clearInterval(timer)
                timer = null
                count = 0
                appTray.setImage(currentTrayMainIcon())
            }
        })

        // 右键
        appTray.on('right-click', () => {
            appTray.popUpContextMenu(contextMenu);
        });
    }
    // 注册快捷键 ctrl + shift + l 打开调试窗口
    globalShortcut.register('CommandOrControl+Shift+L', () => {
        let focusWin = BrowserWindow.getFocusedWindow()
        focusWin && focusWin.toggleDevTools()
    })
    // 禁止f5刷新
    globalShortcut.register('F5', () => {
        return false;
    })
    setupAutoUpdater()
})

// 恢复f5刷新
app.on('will-quit', () => {
    globalShortcut.unregister('F5')
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', data => {
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
