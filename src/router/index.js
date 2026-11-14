import { createRouter, createWebHashHistory } from 'vue-router'

import store from '../store'
import { hardReloadBypassCache } from '@/utils/versionChecker'
import { isMobile } from '@/utils/deviceDetector'
import mobileRoutes from './mobile-routes'

// 懒加载 chunk 404（发版后旧 main 仍引用已删除的 js）时自动刷新；10s 内不重复
const CHUNK_RELOAD_GUARD_KEY = 'workchat_chunk_reload_ts'
const CHUNK_RELOAD_GUARD_MS = 10000

function isLazyChunkLoadError(error) {
  if (!error) return false
  const msg = String(error.message || error)
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

function reloadAfterChunkLoadFailure(reason) {
  console.error('组件加载失败，尝试刷新页面:', reason)
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || 0)
    const now = Date.now()
    if (now - lastReload < CHUNK_RELOAD_GUARD_MS) {
      console.error('组件加载失败且刚刷新过，不再自动刷新')
      return
    }
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now))
  } catch (_) {}
  hardReloadBypassCache()
}

// Vue Router 4 已内置 NavigationDuplicated 处理，不再需要 prototype.push hack。
/**
 * meta 可配置参数
 * @param {boolean} icon 页面icon
 * @param {boolean} keepAlive 是否缓存页面
 * @param {string} title 页面标题
 */
/**
 * PC 端路由（移动端不加载，减小包体积）
 */
function getPcRoutes() {
  return [
    {
      path: '/',
      redirect: {
        path: '/conversation'
      }
    },
    // 登陆页面
    {
      path: '/login',
      name: 'login',
      components: {
        login: () => import(/* webpackChunkName: "login" */ '@/views/LoginPage.vue')
      }
    },
    // 会话的路由
    {
      path: '/conversation',
      name: 'conversation',
      components: {
        main: () => import(/* webpackChunkName: "conversation" */ '@/views/conversation/index.vue')
      },
      meta: {
        requireAuth: true
      }
    },
    // 群发助手路由
    {
      path: '/group-assistant',
      name: 'groupAssistant',
      components: {
        main: () => import(/* webpackChunkName: "groupAssistant" */ '@/views/groupSend/index.vue')
      },
      meta: {
        requireAuth: true
      }
    },
    // 朋友圈的路由
    {
      path: '/friend-circle',
      name: 'friendCircle',
      components: {
        main: () => import(/* webpackChunkName: "friendCircle" */ '@/views/friendCircle/index.vue')
      },
      meta: {
        requireAuth: true
      }
    },
    // 加好友路由
    {
      path: '/add-friend',
      name: 'addFriend',
      components: {
        main: () => import(/* webpackChunkName: "addFriend" */ '@/views/addFriend/index.vue')
      },
      meta: {
        requireAuth: true
      }
    },
    // 功能大全的路由
    {
      path: '/tools',
      name: 'tools',
      components: {
        main: () => import(/* webpackChunkName: "tools" */ '@/views/tools/index.vue')
      },
      meta: {
        requireAuth: true
      }
    },
    // 管理端路由
    {
      path: '/admin',
      name: 'admin',
      components: {
        admin: () => import(/* webpackChunkName: "admin" */ '@/views/admin/index.vue')
      },
      meta: {
        requireAuth: true
      }
    }
  ]
}

const routes = isMobile() ? mobileRoutes : getPcRoutes()

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      // Vue Router 4 的 scrollBehavior 返回 { left, top }（不是 { x, y }）
      return {
        left: 0,
        top: 0
      }
    }
  }
})

// 登陆页面路由 name
// const LOGIN_PAGE_NAME = 'login'

/** 平台超管（type=-1）：仅管理端，不可进客服路由 */
function isSuperAdmin() {
  const t = Number(store.state.adminInfo && store.state.adminInfo.type)
  return t === -1
}

// 全局前置守卫
router.beforeEach((to, from, next) => {
  const wsToken = store.state.webSocketToken
  const httpToken = store.state.httpToken

  const isAdminRoute = to.name === 'admin' || to.meta.adminFeature
  if (isAdminRoute) {
    store.commit('SET_ACTIVE_PANEL', 'admin')
  } else if (to.matched.some((res) => res.meta.requireAuth)) {
    store.commit('SET_ACTIVE_PANEL', 'client')
  }

  // 客服端壳可见（任一 token 在且面板 client）时不得停在 /login 或未匹配路由：
  // 两者均无 main 视图 → 主区一片空白、聚合聊天无选中（SSO 二次进入/输错 hash 常见）。
  // /admin 不会走到这里——上方已把面板切为 admin；内存态卡 /admin 由 App.vue 自愈兜底。
  if (
    store.state.activePanel === 'client' &&
    (wsToken || httpToken) &&
    (to.name === 'login' || to.matched.length === 0)
  ) {
    return next({ path: '/conversation' })
  }

  if (to.matched.some((res) => res.meta.requireAuth)) {
    if (isAdminRoute) {
      if (httpToken) {
        next()
      } else if (wsToken) {
        store.commit('SET_ACTIVE_PANEL', 'client')
        next({ path: '/conversation' })
      } else {
        next({ path: '/login' })
      }
    } else if (isSuperAdmin() && httpToken) {
      // 超管误入 /conversation 等客服路由 → 踢回管理端
      store.commit('SET_ACTIVE_PANEL', 'admin')
      next({ name: 'admin' })
    } else if (wsToken) {
      // client 路由，有 wsToken 直接放行
      next()
    } else if (httpToken) {
      // 客服端面板：允许停在 /conversation 等路由，等待 WS 重连（勿误踢管理端）
      if (store.state.activePanel === 'client') {
        next()
        return
      }
      // 无 wsToken 且非客服端意图：只能渲染管理端壳
      store.commit('SET_ACTIVE_PANEL', 'admin')
      next({ name: 'admin' })
    } else {
      next({ path: '/login' })
    }
  } else {
    next()
  }
})

// 全局解析守卫
router.beforeResolve((to, from, next) => {
  next()
})

// 全局后置钩子
// router.afterEach((to, from) => {
// })

router.onError((error) => {
  if (
    error &&
    (error.name === 'NavigationDuplicated' ||
      (error.message &&
        (error.message.includes('Redirected when going from') ||
          error.message.includes('Navigation cancelled'))))
  ) {
    return
  }
  if (isLazyChunkLoadError(error)) {
    reloadAfterChunkLoadFailure(error.message)
    return
  }
  console.error('路由错误:', error)
})

export default router
