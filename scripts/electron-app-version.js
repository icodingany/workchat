/**
 * Electron 安装包 / app.getVersion() 共用版本号。
 * 格式 YYYY.(M*100+D).HHmm，例：2026-07-28 13:50 → 2026.728.1350
 */

function formatElectronPackageVersion(date) {
  const year = date.getFullYear()
  const md = (date.getMonth() + 1) * 100 + date.getDate()
  const hhmm = Number(
    `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
  )
  return `${year}.${md}.${hhmm}`
}

function resolveElectronAppVersion(options = {}) {
  const fromEnv = options.fromEnv !== false ? process.env.ELECTRON_APP_VERSION : null
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).trim()
  }
  if (options.at != null) {
    return formatElectronPackageVersion(options.at instanceof Date ? options.at : new Date(options.at))
  }
  return formatElectronPackageVersion(new Date())
}

module.exports = {
  formatElectronPackageVersion,
  resolveElectronAppVersion
}
