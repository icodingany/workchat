import { typeFromHttpToken } from './httpTokenClaims'

/**
 * 是否为平台超级管理员（type === -1）。
 * adminInfo.type 有值时以之为准；缺失时回退解析 httpToken JWT 的 type，
 * 避免超管被当成公司管理员进入 /user 设备接口（cid 为空会报「无法获取客户信息」）。
 */
export function isSuperAdminFromState(adminInfo, httpToken) {
  const raw = adminInfo && adminInfo.type
  if (raw !== undefined && raw !== null && raw !== '') {
    return Number(raw) === -1
  }
  return typeFromHttpToken(httpToken) === -1
}
