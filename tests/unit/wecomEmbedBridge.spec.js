import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 客徕徕内嵌企微（iframe）postMessage 桥。
 * 约束：仅当处于 iframe 且是 SSO 内嵌会话时激活；只接受客徕徕域名的消息。
 */

const PARENT_ORIGIN = 'https://test.example.invalid'

function fakeWindow() {
  const listeners = []
  const win = {
    listeners,
    parent: {}, // 非 window.self 即视为 iframe
    self: null,
    addEventListener(type, fn) {
      if (type === 'message') listeners.push(fn)
    },
    postMessage: vi.fn(),
    dispatchMessage(data, origin) {
      listeners.forEach((fn) => fn({ source: 'parent', data, origin: origin || PARENT_ORIGIN }))
    }
  }
  return win
}

function fakeStore(wechats = [], currentWechat = null) {
  const commits = []
  const dispatches = []
  const state = { conversation: { wechats, currentWechat: currentWechat || {} } }
  return {
    commits,
    dispatches,
    state,
    getters: { 'conversation/wechats': wechats },
    commit(type, payload) {
      commits.push([type, payload])
      // 模拟真实 Vuex 同步变更（自动选中后 currentWxId 要能从 state 读到）
      if (type === 'conversation/SET_CURRENT_WECHAT') {
        state.conversation.currentWechat = payload
      }
    },
    dispatch(type, payload) {
      dispatches.push([type, payload])
      return Promise.resolve()
    },
    watch: vi.fn()
  }
}

const WECHATS = [
  { WxId: 'wx_a', WeChatNick: '企微A', Avatar: 'http://a.png', isonline: 1, CorpId: 'corp' },
  { WxId: 'wx_b', WeChatNick: '企微B', Avatar: '', isonline: 0 }
]

async function initBridge(win, store) {
  const { initWecomEmbedBridge } = await import('@/utils/wecomEmbedBridge')
  initWecomEmbedBridge({ win, store })
}

describe('wecomEmbedBridge（企微侧 iframe 桥）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    sessionStorage.clear()
  })

  it('非 iframe（独立打开）时不激活、不监听', async () => {
    const win = fakeWindow()
    win.parent = win // 顶层窗口
    win.self = win
    const store = fakeStore(WECHATS)
    await initBridge(win, store)
    win.dispatchMessage({ type: 'wecom-bridge-handshake' })
    expect(win.postMessage).not.toHaveBeenCalled()
    expect(win.listeners).toHaveLength(0)
  })

  it('iframe 但非 SSO 内嵌会话时不激活', async () => {
    const win = fakeWindow()
    // 未 markSsoEmbedded
    await initBridge(win, fakeStore(WECHATS))
    win.dispatchMessage({ type: 'wecom-bridge-handshake' })
    expect(win.postMessage).not.toHaveBeenCalled()
  })

  it('握手后回 sanitized 账号列表（只带 WxId/昵称/头像/在线）', async () => {
    sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
    const win = fakeWindow()
    const store = fakeStore(WECHATS)
    await initBridge(win, store)
    win.dispatchMessage({ type: 'wecom-bridge-handshake' })
    expect(win.postMessage).toHaveBeenCalledTimes(1)
    const msg = win.postMessage.mock.calls[0][0]
    expect(msg.type).toBe('wecom-bridge-wechats')
    expect(msg.wechats).toEqual([
      { WxId: 'wx_a', WeChatNick: '企微A', Avatar: 'http://a.png', IsOnline: true },
      { WxId: 'wx_b', WeChatNick: '企微B', Avatar: '', IsOnline: false }
    ])
    expect(msg.currentWxId).toBeDefined()
  })

  it('拒绝非白名单来源的消息', async () => {
    sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
    const win = fakeWindow()
    await initBridge(win, fakeStore(WECHATS))
    win.dispatchMessage({ type: 'wecom-bridge-handshake' }, 'https://evil.example.com')
    expect(win.postMessage).not.toHaveBeenCalled()
  })

  it('select 指令：选中在线账号并触发客户/通讯录拉取', async () => {
    sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
    const win = fakeWindow()
    const store = fakeStore(WECHATS)
    await initBridge(win, store)
    win.dispatchMessage({ type: 'wecom-bridge-select', wxId: 'wx_a' })
    expect(store.commits).toContainEqual(['conversation/SET_CURRENT_WECHAT', expect.objectContaining({ WxId: 'wx_a' })])
    expect(store.dispatches).toContainEqual(['conversation/SetCurrentCustomers', 'wx_a'])
    expect(store.dispatches).toContainEqual(['conversation/SetCurrentContacts', 'wx_a'])
  })

  it('select 指令：离线账号拒绝并回执 select-failed', async () => {
    sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
    const win = fakeWindow()
    const store = fakeStore(WECHATS)
    await initBridge(win, store)
    win.dispatchMessage({ type: 'wecom-bridge-select', wxId: 'wx_b' })
    expect(store.commits).not.toContainEqual(['conversation/SET_CURRENT_WECHAT', expect.anything()])
    expect(win.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'wecom-bridge-select-failed', wxId: 'wx_b' }),
      PARENT_ORIGIN
    )
  })

  it('账号列表变化（握手后）主动推送最新列表', async () => {
    sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
    const win = fakeWindow()
    const store = fakeStore(WECHATS)
    // 模拟 store.watch：捕获 getter 订阅回调
    const watchers = {}
    store.watch = vi.fn((getter, cb) => {
      watchers.wechats = cb
    })
    await initBridge(win, store)
    win.dispatchMessage({ type: 'wecom-bridge-handshake' })
    win.postMessage.mockClear()
    watchers.wechats([...WECHATS, { WxId: 'wx_c', WeChatNick: 'C', isonline: 1 }])
    expect(win.postMessage).toHaveBeenCalledTimes(1)
    const msg = win.postMessage.mock.calls[0][0]
    expect(msg.type).toBe('wecom-bridge-wechats')
    expect(msg.wechats).toHaveLength(3)
  })

  describe('内嵌态自动选中（对齐 AsidePage wechatsOnline watcher）', () => {
    function storeWithWatcher(wechats, currentWechat) {
      const store = fakeStore(wechats, currentWechat)
      const watchers = {}
      store.watch = vi.fn((getter, cb) => {
        watchers.wechats = cb
      })
      return { store, watchers }
    }

    it('列表到达且无当前号：自动选中第一个在线号并推送 currentWxId', async () => {
      sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
      const win = fakeWindow()
      const { store, watchers } = storeWithWatcher(WECHATS)
      await initBridge(win, store)
      win.dispatchMessage({ type: 'wecom-bridge-handshake' })
      win.postMessage.mockClear()

      watchers.wechats(WECHATS)

      // 对齐 AsidePage.choseWechat 全套联动
      expect(store.commits).toContainEqual([
        'conversation/SET_CURRENT_WECHAT',
        expect.objectContaining({ WxId: 'wx_a' })
      ])
      expect(store.dispatches).toContainEqual(['conversation/SetCurrentCustomers', 'wx_a'])
      expect(store.dispatches).toContainEqual(['conversation/SetCurrentContacts', 'wx_a'])
      expect(store.dispatches).toContainEqual([
        'conversation/LoadConversationSnapshot',
        expect.objectContaining({ wxId: 'wx_a' })
      ])
      // 推送给宿主的列表带上新 currentWxId，客徕徕侧据此高亮
      expect(win.postMessage).toHaveBeenCalledTimes(1)
      const msg = win.postMessage.mock.calls[0][0]
      expect(msg.type).toBe('wecom-bridge-wechats')
      expect(msg.currentWxId).toBe('wx_a')
    })

    it('已有当前号：不自动改选（不抢宿主已选的号）', async () => {
      sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
      const win = fakeWindow()
      const { store, watchers } = storeWithWatcher(WECHATS, {
        WxId: 'wx_a',
        WeChatNick: '企微A'
      })
      await initBridge(win, store)
      win.dispatchMessage({ type: 'wecom-bridge-handshake' })

      watchers.wechats(WECHATS)

      expect(store.commits).not.toContainEqual(['conversation/SET_CURRENT_WECHAT', expect.anything()])
    })

    it('列表全离线：不自动选中', async () => {
      sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
      const win = fakeWindow()
      const offline = [WECHATS[1]] // wx_b isonline: 0
      const { store, watchers } = storeWithWatcher(offline)
      await initBridge(win, store)
      win.dispatchMessage({ type: 'wecom-bridge-handshake' })

      watchers.wechats(offline)

      expect(store.commits).not.toContainEqual(['conversation/SET_CURRENT_WECHAT', expect.anything()])
    })

    it('空列表：不动作', async () => {
      sessionStorage.setItem('loginViaSsoOfJuboChat', '1')
      const win = fakeWindow()
      const { store, watchers } = storeWithWatcher([])
      await initBridge(win, store)
      win.dispatchMessage({ type: 'wecom-bridge-handshake' })

      watchers.wechats([])

      expect(store.commits).not.toContainEqual(['conversation/SET_CURRENT_WECHAT', expect.anything()])
    })
  })
})
