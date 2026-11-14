import { describe, it, expect } from 'vitest'
import { getAdminNavigation, flattenNavigation, clientNavigation } from '@/config/navigation'

describe('导航共享配置', () => {
  describe('clientNavigation', () => {
    it('包含所有 PC 客户端功能入口', () => {
      const names = clientNavigation.map((n) => n.name)
      expect(names).toContain('聚合聊天')
      expect(names).toContain('朋友圈')
      expect(names).toContain('群发')
      expect(names).toContain('加好友')
      expect(names).toContain('功能大全')
      expect(clientNavigation).toHaveLength(5)
    })

    it('每个入口都有有效路径', () => {
      clientNavigation.forEach((n) => {
        expect(n.path).toMatch(/^\//)
        expect(typeof n.icon).toBe('string')
        expect(n.name.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getAdminNavigation — 公司管理员（普通管理员）', () => {
    it('不包含超管专属项', () => {
      const navs = getAdminNavigation(false)
      const flat = flattenNavigation(navs)
      const paths = flat.map((n) => n.navPath)
      expect(paths).not.toContain('customerManagement')
      expect(paths).not.toContain('phonesManagementSuper')
      expect(paths).not.toContain('regCodeManagement')
    })

    it('包含账号管理', () => {
      const flat = flattenNavigation(getAdminNavigation(false))
      const paths = flat.map((n) => n.navPath)
      expect(paths).toContain('accountManagement')
    })

    it('企微号管理有子菜单', () => {
      const navs = getAdminNavigation(false)
      const wq = navs.find((n) => n.navName === '企微号管理')
      expect(wq).toBeDefined()
      expect(wq.children.map((c) => c.navPath)).toEqual(['friendList', 'chatRoomList', 'newFriendAutoReply'])
    })

    it('辅助营销有子菜单', () => {
      const navs = getAdminNavigation(false)
      const aux = navs.find((n) => n.navName === '辅助营销')
      expect(aux).toBeDefined()
      expect(aux.children.map((c) => c.navPath)).toEqual(['scheduledMassMessage', 'scheduledMoments', 'materialLibrary'])
    })
  })

  describe('getAdminNavigation — 超级管理员（type=-1）', () => {
    it('仅三项，不包含公司管理员项', () => {
      const navs = getAdminNavigation(true)
      expect(navs).toHaveLength(3)
      const paths = navs.map((n) => n.navPath)
      expect(paths).toContain('customerManagement')
      expect(paths).toContain('phonesManagementSuper')
      expect(paths).toContain('regCodeManagement')
      expect(paths).not.toContain('accountManagement')
      expect(paths).not.toContain('commonReplies')
    })
  })
})
