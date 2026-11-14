import { expect } from 'chai'
import { vi } from 'vitest'
import {
  kickTabToLogin,
  setupSiblingTabKick,
  claimWsSessionOwner
} from '@/utils/wsSessionOwner'

const closeWebsocket = vi.fn()
vi.mock('@/websocket/websocket', () => ({ closeWebsocket }))

describe('wsSessionOwner kick / sibling tab', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    closeWebsocket.mockClear()
  })

  it('已在 login 页时不 replace', async () => {
    const store = { commit: vi.fn() }
    const router = {
      currentRoute: { name: 'login' },
      replace: vi.fn(() => Promise.resolve())
    }
    kickTabToLogin(store, router)
    await new Promise((r) => setTimeout(r, 0))
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('setupSiblingTabKick 其它 Tab claim 时触发 kick', async () => {
    claimWsSessionOwner()
    const oldGlobal = localStorage.getItem('workchat_ws_owner')

    const store = { commit: vi.fn() }
    const router = {
      currentRoute: { name: 'conversation' },
      replace: vi.fn(() => Promise.resolve())
    }

    setupSiblingTabKick(store, router)

    localStorage.setItem('workchat_ws_owner', 'ws_other_tab')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'workchat_ws_owner',
        newValue: 'ws_other_tab',
        oldValue: oldGlobal
      })
    )

    await new Promise((r) => setTimeout(r, 0))
    expect(closeWebsocket).toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith({ name: 'login' })
  })
})
