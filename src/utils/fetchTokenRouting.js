/**
 * HTTP 双 token 分流纯函数（从 fetch.js 抽出，便于单测）。
 *
 * /admin/**、/user/**、/api/regcode/** → httpToken（JWT）
 * 其余 → 优先 httpToken，再 validateToken / webSocketToken
 */

/**
 * @param {string} url 请求路径（相对 baseURL）
 * @param {{ httpToken?: string, validateToken?: string, webSocketToken?: string }} tokens
 * @returns {{ Authorization?: string, token?: string }}
 */
export function resolveFetchAuthHeaders(url, tokens = {}) {
  const path = url || ''
  const isAdminApi = path.indexOf('/admin/') === 0
  const isUserApi = path.indexOf('/user/') === 0
  const isRegCodeApi = path.indexOf('/api/regcode') === 0
  const httpToken = tokens.httpToken || ''
  const validateToken = tokens.validateToken || tokens.webSocketToken || ''

  if (isAdminApi || isUserApi || isRegCodeApi) {
    if (!httpToken) return {}
    return {
      Authorization: `Bearer ${httpToken}`,
      token: httpToken
    }
  }

  const bearer = httpToken || validateToken
  if (!bearer) return {}
  const headers = { Authorization: `Bearer ${bearer}` }
  if (httpToken) headers.token = httpToken
  return headers
}
