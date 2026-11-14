/**
 * Web 端环境变量桥接层（对齐 kelailaichatpc/scripts/vite-env-defines.cjs，裁剪至 workchat 变量集）
 *
 * 作用：业务代码大量使用 process.env.VUE_APP_*（vue-cli 时代遗留）。Vite 原生只认 import.meta.env.VITE_*，
 * 故通过本模块把 .env.* 里的 VUE_APP_* 读出来，在 vite.config.mjs 里 define 成 process.env.VUE_APP_*，
 * 实现"不改前缀、不改业务代码"的迁移。
 *
 * 不依赖 dotenv（workchat 未安装），用纯 fs 解析 KEY=VALUE。
 */

const fs = require('fs')
const path = require('path')

const ENV_FILE_BY_MODE = {
  development: '.env.development',
  'development.electron': '.env.development.electron',
  'development.tauri': '.env.development.tauri',
  stage: '.env.stage',
  test: '.env.test',
  production: '.env.production',
  'production.electron': '.env.production.electron',
  'production.tauri': '.env.production.tauri'
}

// 干净发布目录里可能没有 .env.production，使用本地默认值，避免 baseURL 为空。
const PROD_WEB_DEFAULTS = {
  VUE_APP_CURRENTMODE: 'web',
  VUE_APP_FETCH_URL: 'http://127.0.0.1:15086',
  VUE_APP_MASTER_FETCH_URL: 'http://127.0.0.1:18080',
  VUE_APP_WEBSOCKET_URL: 'ws://127.0.0.1:15088',
  VUE_APP_ROBOT_URL: 'http://127.0.0.1:18082',
  VUE_APP_UPLOAD_URL: 'http://127.0.0.1:18081/fileUpload'
}

// 本地 serve：默认对齐生产 API；不配 ROBOT/UPLOAD 也不致空指针（业务侧再兜底）
const DEV_WEB_DEFAULTS = {
  VUE_APP_CURRENTMODE: 'web',
  VUE_APP_FETCH_URL: 'http://127.0.0.1:15086',
  VUE_APP_MASTER_FETCH_URL: 'http://127.0.0.1:18080',
  VUE_APP_WEBSOCKET_URL: 'ws://127.0.0.1:15088'
}

function getEnvFileName(mode) {
  return ENV_FILE_BY_MODE[mode] || '.env'
}

function getDefaultEnvForMode(mode) {
  if (mode === 'production' || mode === 'production.electron' || mode === 'production.tauri') {
    return PROD_WEB_DEFAULTS
  }
  if (mode === 'development' || mode === 'development.electron' || mode === 'development.tauri') {
    return DEV_WEB_DEFAULTS
  }
  return {}
}

/**
 * 纯 fs 解析 .env 文件（KEY=VALUE，支持引号、# 注释、忽略空行）。
 * 不展开变量引用（业务 .env 不用 ${VAR}），保持最小实现。
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const text = fs.readFileSync(filePath, 'utf-8')
  const out = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // 去引号
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function applyViteEnvDefaults(mode, env = {}) {
  return { ...getDefaultEnvForMode(mode), ...env }
}

function loadViteEnvForMode(mode, projectRoot) {
  const envFileName = getEnvFileName(mode)
  const envPath = path.resolve(projectRoot, envFileName)
  const parsed = parseEnvFile(envPath)
  return applyViteEnvDefaults(mode, parsed)
}

function buildViteEnvDefines(env = {}) {
  const envDefines = {}
  for (const key in env) {
    if (key.startsWith('VUE_APP_')) {
      envDefines['process.env.' + key] = JSON.stringify(env[key])
    }
  }
  return envDefines
}

/**
 * Vite 5+ 的 vite:define 在 client serve 时不替换 process.env.*。
 * 开发态浏览器里 process.env 常为 {}，导致 VUE_APP_FETCH_URL 为空、请求打到 Vite dev 端口 → 404。
 * 本插件在 transform 阶段把 VUE_APP_* 内联进源码（dev/build 均可，build 已 define 时为 no-op）。
 */
function createVueAppEnvDevPlugin(env = {}) {
  const replacements = buildViteEnvDefines(env)
  const keys = Object.keys(replacements)
  return {
    name: 'vue-app-env-dev-define',
    transform(code, id) {
      if (!keys.length || !code || !code.includes('process.env.VUE_APP_')) return null
      if (id.includes('node_modules')) return null
      let out = code
      let hit = false
      for (const key of keys) {
        if (!out.includes(key)) continue
        out = out.split(key).join(replacements[key])
        hit = true
      }
      return hit ? { code: out, map: null } : null
    }
  }
}

module.exports = {
  applyViteEnvDefaults,
  buildViteEnvDefines,
  createVueAppEnvDevPlugin,
  getDefaultEnvForMode,
  getEnvFileName,
  loadViteEnvForMode,
  parseEnvFile
}
