import { describe, it, expect } from 'vitest'
import mobileRoutes from '@/router/mobile-routes'

describe('移动端路由', () => {
  const paths = mobileRoutes.map((r) => r.path)

  it('包含基础页面', () => {
    expect(paths).toContain('/')
    expect(paths).toContain('/login')
    expect(paths).toContain('/conversation')
    expect(paths).toContain('/chat')
    expect(paths).toContain('/admin')
    expect(paths).toContain('/manager')
    expect(paths).toContain('/chat-room-members')
  })

  it('包含朋友圈、群发、加好友、功能大全', () => {
    expect(paths).toContain('/friend-circle')
    expect(paths).toContain('/group-assistant')
    expect(paths).toContain('/add-friend')
    expect(paths).toContain('/tools')
  })

  it('管理子页全部注册', () => {
    const adminPaths = paths.filter((p) => p.startsWith('/admin/'))
    expect(adminPaths).toContain('/admin/accountManagement')
    expect(adminPaths).toContain('/admin/phonesManagement')
    expect(adminPaths).toContain('/admin/customerManagement')
    expect(adminPaths).toContain('/admin/regCodeManagement')
    expect(adminPaths).toContain('/admin/commonReplies')
    expect(adminPaths).toContain('/admin/commonTags')
    expect(adminPaths).toContain('/admin/friendList')
    expect(adminPaths).toContain('/admin/chatRoomList')
    expect(adminPaths).toContain('/admin/newFriendAutoReply')
    expect(adminPaths).toContain('/admin/scheduledMassMessage')
    expect(adminPaths).toContain('/admin/scheduledMoments')
    expect(adminPaths).toContain('/admin/materialLibrary')
  })

  it('所有需要认证的路由都标记 requireAuth', () => {
    const authRoutes = mobileRoutes.filter((r) => r.meta?.requireAuth)
    expect(authRoutes.length).toBeGreaterThan(10)
    const authPaths = authRoutes.map((r) => r.path)
    expect(authPaths).toContain('/conversation')
    expect(authPaths).toContain('/friend-circle')
    expect(authPaths).toContain('/group-assistant')
    expect(authPaths).toContain('/admin')
    expect(authPaths).toContain('/admin/accountManagement')
  })

  it('管理子页标记 adminFeature', () => {
    const adminFeatureRoutes = mobileRoutes.filter((r) => r.meta?.adminFeature)
    const authPaths = adminFeatureRoutes.map((r) => r.path)
    expect(authPaths).toContain('/admin/accountManagement')
    expect(authPaths).toContain('/admin/friendList')
    expect(authPaths).toContain('/admin/materialLibrary')
  })

  it('客户端功能页不标记 adminFeature', () => {
    const clientFeatureRoutes = mobileRoutes.filter(
      (r) => ['/friend-circle', '/group-assistant', '/add-friend', '/tools'].includes(r.path)
    )
    clientFeatureRoutes.forEach((r) => {
      expect(r.meta?.adminFeature).toBeFalsy()
    })
  })

  it('登录页不标记 requireAuth', () => {
    const loginRoute = mobileRoutes.find((r) => r.path === '/login')
    expect(loginRoute.meta?.requireAuth).toBeFalsy()
  })

  it('所有路由都有 component（重定向路由除外）', () => {
    mobileRoutes.forEach((r) => {
      if (r.redirect) return // 重定向路由无 component
      expect(r.component).toBeDefined()
    })
  })

  it('根路径重定向到 /conversation', () => {
    const root = mobileRoutes.find((r) => r.path === '/')
    expect(root.redirect.path).toBe('/conversation')
  })
})
