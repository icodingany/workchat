import { getAdminNavigation, flattenNavigation } from '@/config/navigation'

/**
 * 企微管理端深链定位：客徕徕把企微管理端各页面嵌进 iframe，
 * 通过 `#/admin?nav=<navPath>`（或 SSO 登录前由 LoginPage 暂存的
 * sessionStorage `wecomAdminNav`）指定打开哪个管理页。
 */

export const WECOM_ADMIN_NAV_STORAGE_KEY = 'wecomAdminNav'

/**
 * 从路由 query / 暂存 key 解析出合法的导航项。
 * @param {Object} query 路由 query（如 { nav: 'scheduledMassMessage' }）
 * @param {Object} [opts] { superAdmin, storage } 测试注入
 * @returns {{navName:string,navPath:string}|null} 合法导航项；非法/缺省返回 null（保持默认页）
 */
export function resolveNavFromQuery(query, opts = {}) {
  const storage = opts.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
  let navPath = (query && query.nav) || ''
  try {
    if (!navPath && storage) {
      navPath = storage.getItem(WECOM_ADMIN_NAV_STORAGE_KEY) || ''
    }
    if (storage) storage.removeItem(WECOM_ADMIN_NAV_STORAGE_KEY)
  } catch (e) {
    /* ignore quota / private mode */
  }
  if (!navPath) return null
  const all = flattenNavigation(getAdminNavigation(!!opts.superAdmin))
  return all.find((n) => n.navPath === navPath) || null
}
