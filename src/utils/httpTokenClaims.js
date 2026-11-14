/**
 * 从 httpToken（JWT）解析 payload 字段，供 adminInfo 缺失时兜底。
 * 不校验签名（仅读本地已存 token 的声明；鉴权仍由后端完成）。
 */

export function parseHttpTokenPayload(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = JSON.parse(decodeURIComponent(escape(atob(b64 + pad))))
    return json && typeof json === 'object' ? json : null
  } catch (e) {
    return null
  }
}

/** @returns {number|null} 账号 type；无法解析时返回 null */
export function typeFromHttpToken(token) {
  const payload = parseHttpTokenPayload(token)
  if (!payload || payload.type === undefined || payload.type === null || payload.type === '') {
    return null
  }
  const n = Number(payload.type)
  return Number.isFinite(n) ? n : null
}
