import { expect } from 'chai'
import { markSsoEmbedded, clearSsoEmbedded, isSsoEmbedded } from '@/utils/ssoEmbedded'

describe('ssoEmbedded 内嵌企微 tab 标记', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('默认未标记：独立访问展示头像昵称下拉', () => {
    expect(isSsoEmbedded()).to.be.false
  })

  it('SSO 登录成功后标记内嵌态', () => {
    markSsoEmbedded()
    expect(isSsoEmbedded()).to.be.true
  })

  it('账号密码登录 / 退出登录后清除标记', () => {
    markSsoEmbedded()
    clearSsoEmbedded()
    expect(isSsoEmbedded()).to.be.false
  })

  it('标记仅存于当前标签页会话（sessionStorage），不污染独立访问', () => {
    markSsoEmbedded()
    expect(sessionStorage.getItem('loginViaSsoOfJuboChat')).to.equal('1')
    expect(localStorage.getItem('loginViaSsoOfJuboChat')).to.be.null
  })
})
