'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ASCII_INSTALLER_NAME = 'workchat-Setup-update.exe'
const CACHE_DIR_NAMES = ['workchat-updater', 'jubo-work-chat-updater']

function resolveDownloadedInstallerPath(opts = {}) {
  const helper = opts.downloadedUpdateHelper
  if (helper && helper.file && fs.existsSync(helper.file)) {
    return helper.file
  }
  const localAppData = opts.localAppData || process.env.LOCALAPPDATA || ''
  if (!localAppData) return null
  const names = opts.cacheDirNames || CACHE_DIR_NAMES
  let best = null
  for (const cacheName of names) {
    const pendingDir = path.join(localAppData, cacheName, 'pending')
    if (!fs.existsSync(pendingDir)) continue
    const exes = fs
      .readdirSync(pendingDir)
      .filter((n) => /\.exe$/i.test(n))
      .map((n) => {
        const full = path.join(pendingDir, n)
        const st = fs.statSync(full)
        return { full, mtimeMs: st.mtimeMs, size: st.size }
      })
      .filter((x) => x.size > 1024 * 1024)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
    if (exes.length && (!best || exes[0].mtimeMs > best.mtimeMs)) {
      best = exes[0]
    }
  }
  return best ? best.full : null
}

function ensureAsciiInstallerPath(srcPath) {
  const src = String(srcPath || '')
  if (!src || !fs.existsSync(src)) {
    throw new Error('installer source missing')
  }
  const dest = path.join(path.dirname(src), ASCII_INSTALLER_NAME)
  if (path.resolve(src) === path.resolve(dest)) {
    return { installerPath: dest, copied: false }
  }
  fs.copyFileSync(src, dest)
  return { installerPath: dest, copied: true }
}

function spawnInstallerAndQuit(opts) {
  const log = typeof opts.logFn === 'function' ? opts.logFn : () => {}
  const spawnFn = opts.spawnFn || spawn
  const quitFn = opts.quitFn || (() => {})
  try {
    const { installerPath, copied } = ensureAsciiInstallerPath(opts.srcPath)
    log(
      '[autoUpdater] spawn installer path=' +
        installerPath +
        (copied ? ' (ascii copy)' : '')
    )
    const child = spawnFn(installerPath, ['--updated', '--force-run'], {
      detached: true,
      stdio: 'ignore'
    })
    if (child && typeof child.unref === 'function') child.unref()
    log('[autoUpdater] installer spawned pid=' + (child && child.pid))
    setImmediate(() => {
      try {
        quitFn()
      } catch (e) {
        log('[autoUpdater] quit after spawn failed: ' + (e && e.message ? e.message : e))
      }
    })
    return { ok: true, installerPath }
  } catch (e) {
    const message = e && e.message ? e.message : String(e)
    log('[autoUpdater] spawnInstallerAndQuit failed: ' + message)
    if (typeof opts.openPathFn === 'function') {
      try {
        const { installerPath } = ensureAsciiInstallerPath(opts.srcPath)
        Promise.resolve(opts.openPathFn(installerPath)).catch(() => {})
        setImmediate(() => {
          try {
            quitFn()
          } catch (_) {
            /* ignore */
          }
        })
        return { ok: true, installerPath, error: message }
      } catch (e2) {
        return { ok: false, error: message }
      }
    }
    return { ok: false, error: message }
  }
}

module.exports = {
  ASCII_INSTALLER_NAME,
  CACHE_DIR_NAMES,
  resolveDownloadedInstallerPath,
  ensureAsciiInstallerPath,
  spawnInstallerAndQuit
}
