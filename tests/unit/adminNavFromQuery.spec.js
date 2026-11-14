import { describe, it, expect, beforeEach } from 'vitest'
import { resolveNavFromQuery, WECOM_ADMIN_NAV_STORAGE_KEY } from '@/utils/adminNavFromQuery'

function fakeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  }
}

describe('adminNavFromQuery（企微管理端深链定位）', () => {
  let storage
  beforeEach(() => {
    storage = fakeStorage()
  })

  it('query.nav 合法 → 返回对应导航项，并清掉暂存 key', () => {
    storage.setItem(WECOM_ADMIN_NAV_STORAGE_KEY, 'friendList')
    const hit = resolveNavFromQuery({ nav: 'scheduledMassMessage' }, { storage })
    expect(hit).toMatchObject({ navPath: 'scheduledMassMessage' })
    expect(storage.getItem(WECOM_ADMIN_NAV_STORAGE_KEY)).toBeNull()
  })

  it('query 无 nav 时回落 sessionStorage 暂存（SSO 登录前 LoginPage 存的）', () => {
    storage.setItem(WECOM_ADMIN_NAV_STORAGE_KEY, 'materialLibrary')
    const hit = resolveNavFromQuery({}, { storage })
    expect(hit).toMatchObject({ navPath: 'materialLibrary' })
    expect(storage.getItem(WECOM_ADMIN_NAV_STORAGE_KEY)).toBeNull()
  })

  it('无任何来源 → null（保持默认页）', () => {
    expect(resolveNavFromQuery({}, { storage })).toBeNull()
  })

  it('非法 navPath（如超管专属或乱串）→ null，不抛错', () => {
    expect(resolveNavFromQuery({ nav: 'notExistNav' }, { storage })).toBeNull()
    expect(resolveNavFromQuery({ nav: '../evil' }, { storage })).toBeNull()
  })

  it('superAdmin 导航集里没有企微页面 → 公司侧 navPath 对超管非法', () => {
    expect(resolveNavFromQuery({ nav: 'friendList' }, { storage, superAdmin: true })).toBeNull()
  })
})
