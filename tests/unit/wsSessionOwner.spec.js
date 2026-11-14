import { expect } from 'chai'
import {
  claimWsSessionOwner,
  getWsSessionOwnerId,
  isCurrentWsSessionOwner,
  releaseWsSessionOwnerIfHeld
} from '@/utils/wsSessionOwner'

const OWNER_KEY = 'workchat_ws_owner'
const SESSION_OWNER_KEY = 'workchat_ws_session_owner'

describe('wsSessionOwner（多 Tab 登录互踢）', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('claim 生成唯一 id 并写入 localStorage + sessionStorage', () => {
    const id = claimWsSessionOwner()
    expect(id).to.match(/^ws_/)
    expect(localStorage.getItem(OWNER_KEY)).to.equal(id)
    expect(sessionStorage.getItem(SESSION_OWNER_KEY)).to.equal(id)
    expect(getWsSessionOwnerId()).to.equal(id)
  })

  it('claim 两次生成不同 id（每次登录新会话）', () => {
    const a = claimWsSessionOwner()
    const b = claimWsSessionOwner()
    expect(a).not.to.equal(b)
  })

  it('本 Tab 是当前 owner 时返回 true', () => {
    claimWsSessionOwner()
    expect(isCurrentWsSessionOwner()).to.equal(true)
  })

  it('全局 owner 与本 Tab owner 不一致时（被别 Tab 挤）返回 false', () => {
    const mine = claimWsSessionOwner()
    // 模拟其它 Tab 覆盖全局 owner
    localStorage.setItem(OWNER_KEY, mine + '-other')
    expect(isCurrentWsSessionOwner()).to.equal(false)
  })

  it('无全局 owner（release 后）保守视为当前 owner', () => {
    claimWsSessionOwner()
    releaseWsSessionOwnerIfHeld()
    expect(localStorage.getItem(OWNER_KEY)).to.equal(null)
    // 全局 key 已清空 → isCurrent 返回 true（不阻断认证）
    expect(isCurrentWsSessionOwner()).to.equal(true)
  })

  it('release 仅清掉当前持有的归属，不影响其它 Tab 已写入的全局 id', () => {
    claimWsSessionOwner()
    // 模拟别的 Tab 是新 owner（全局被覆盖成别人）
    localStorage.setItem(OWNER_KEY, 'ws_other')
    sessionStorage.setItem(SESSION_OWNER_KEY, 'ws_mine')
    releaseWsSessionOwnerIfHeld()
    // 全局 key 是别人的，不应被本 Tab release 清掉
    expect(localStorage.getItem(OWNER_KEY)).to.equal('ws_other')
  })

  it('sessionStorage 清空时保守视为 owner', () => {
    localStorage.setItem(OWNER_KEY, 'ws_global')
    sessionStorage.clear()
    expect(isCurrentWsSessionOwner()).to.equal(true)
  })
})