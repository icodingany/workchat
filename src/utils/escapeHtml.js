/**
 * v-html 插值前的最小 HTML 转义（防 XSS）。
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
