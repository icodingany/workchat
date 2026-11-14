'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_FEED_URL = 'https://file.example.invalid/workchat/'
const DEFAULT_CACHE_DIR_NAME = 'workchat-updater'

function buildAppUpdateYmlContent(feedUrl = DEFAULT_FEED_URL) {
  const url = String(feedUrl || DEFAULT_FEED_URL).replace(/\s+/g, '')
  const normalized = url.endsWith('/') ? url : `${url}/`
  return [
    'provider: generic',
    `url: ${normalized}`,
    `updaterCacheDirName: ${DEFAULT_CACHE_DIR_NAME}`,
    ''
  ].join('\n')
}

/**
 * 确保 electron-updater 能读到 app-update.yml。
 * @param {{ resourcesPath: string, userDataPath: string, setUpdateConfigPath?: (p: string) => void, feedUrl?: string }} opts
 */
function ensureAppUpdateConfig(opts) {
  const resourcesPath = opts && opts.resourcesPath
  const userDataPath = opts && opts.userDataPath
  const feedUrl = opts && opts.feedUrl
  const setUpdateConfigPath = opts && opts.setUpdateConfigPath
  const content = buildAppUpdateYmlContent(feedUrl)
  const bundled = path.join(String(resourcesPath || ''), 'app-update.yml')

  if (bundled && fs.existsSync(bundled)) {
    return { path: bundled, created: false }
  }

  try {
    fs.mkdirSync(path.dirname(bundled), { recursive: true })
    fs.writeFileSync(bundled, content, 'utf8')
    return { path: bundled, created: true }
  } catch (_) {
    const fallback = path.join(String(userDataPath || ''), 'app-update.yml')
    fs.mkdirSync(path.dirname(fallback), { recursive: true })
    fs.writeFileSync(fallback, content, 'utf8')
    if (typeof setUpdateConfigPath === 'function') {
      setUpdateConfigPath(fallback)
    }
    return { path: fallback, created: true, fallback: true }
  }
}

module.exports = {
  DEFAULT_FEED_URL,
  DEFAULT_CACHE_DIR_NAME,
  buildAppUpdateYmlContent,
  ensureAppUpdateConfig
}
