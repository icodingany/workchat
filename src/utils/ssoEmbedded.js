/**
 * 客徕徕内嵌企微 tab（SSO 兑换登录）运行态标记。
 * 内嵌态下顶栏隐藏本端的头像昵称下拉（修改密码/退出系统），
 * 身份与密码均由客徕徕宿主管，避免内嵌页出现重复入口。
 * 用 sessionStorage（tab 级）：仅当前内嵌会话生效，不污染同浏览器独立访问。
 */
const SSO_EMBEDDED_KEY = 'loginViaSsoOfJuboChat'

export function markSsoEmbedded() {
  try {
    sessionStorage.setItem(SSO_EMBEDDED_KEY, '1')
  } catch (e) {
    /* ignore quota / private mode */
  }
}

export function clearSsoEmbedded() {
  try {
    sessionStorage.removeItem(SSO_EMBEDDED_KEY)
  } catch (e) {
    /* ignore */
  }
}

export function isSsoEmbedded() {
  try {
    return sessionStorage.getItem(SSO_EMBEDDED_KEY) === '1'
  } catch (e) {
    return false
  }
}
