'use strict'

/**
 * 将 electron-updater 原始错误转为可读中文提示。
 * @param {Error|string} err
 * @returns {{ code: string, tip: string, raw: string }}
 */
function formatUpdaterError(err) {
  const raw = err && err.message ? String(err.message) : String(err || '')
  const code = (err && err.code) || ''
  let tip = '检查更新失败，请稍后重试。'

  if (/ERR_UPDATER_INVALID_VERSION/i.test(raw) || /Invalid version/i.test(raw)) {
    tip = '更新服务器版本号无效，请联系管理员重新发布安装包。'
  } else if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(raw)) {
    tip = '无法连接更新服务器，请检查网络后重试。'
  } else if (/sha512|checksum|HASH/i.test(raw)) {
    tip = '更新包校验失败，请稍后重试或手动下载安装包。'
  } else if (/ENOENT|app-update\.yml/i.test(raw)) {
    tip = '更新配置缺失，请重新安装客户端。'
  } else if (raw) {
    tip = raw.length > 160 ? raw.slice(0, 160) + '…' : raw
  }

  return { code: String(code || ''), tip, raw }
}

module.exports = {
  formatUpdaterError
}
