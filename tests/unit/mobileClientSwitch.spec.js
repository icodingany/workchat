import { expect } from 'chai'

/**
 * Mobile admin-to-client navigation has a WebSocket-authentication gate because
 * the global router guard rejects /conversation without a webSocketToken.
 */
function planMobileClientSwitch({ hasWsToken }) {
  const steps = []

  if (!hasWsToken) {
    steps.push('ensureClientWsLogin')
  }

  steps.push('router.replace:/conversation')
  steps.push('SET_ACTIVE_PANEL:client')
  steps.push('SET_CLIENT_OR_SERVER:client')
  steps.push('GetWeChatsReq')
  return steps
}

function assertMobileAdminSource(source) {
  // 切换逻辑已从 mobile/views/admin.vue 抽到共享组件 AppModeSwitch.vue（switchTo）
  const switchStart = source.indexOf('async switchTo(panel)')
  const switchEnd = source.indexOf("replace({ name: 'admin' })", switchStart)
  const switchBlock = source.slice(switchStart, switchEnd)
  const authIdx = switchBlock.indexOf('await this.ensureClientWsLogin()')
  const routeIdx = switchBlock.indexOf("replace({ path: '/conversation' })")
  const panelIdx = switchBlock.indexOf("SET_ACTIVE_PANEL', 'client'")

  expect(authIdx, '切换前应确保客服端 WebSocket 已认证').to.be.at.least(0)
  expect(routeIdx, '认证成功后应导航到 /conversation').to.be.at.least(0)
  expect(panelIdx, '导航成功后应切换客服端面板').to.be.at.least(0)
  expect(authIdx, '应先认证，再尝试客服端路由').to.be.lessThan(routeIdx)
  expect(routeIdx, '应先完成路由导航，再切换面板').to.be.lessThan(panelIdx)
}

describe('mobile admin client switch plan', () => {
  it('仅管理端 HTTP 登录时，先认证 WebSocket 再进入客服端', () => {
    expect(planMobileClientSwitch({ hasWsToken: false })).to.deep.equal([
      'ensureClientWsLogin',
      'router.replace:/conversation',
      'SET_ACTIVE_PANEL:client',
      'SET_CLIENT_OR_SERVER:client',
      'GetWeChatsReq'
    ])
  })

  it('已有 WebSocket token 时直接进入客服端', () => {
    expect(planMobileClientSwitch({ hasWsToken: true })).to.deep.equal([
      'router.replace:/conversation',
      'SET_ACTIVE_PANEL:client',
      'SET_CLIENT_OR_SERVER:client',
      'GetWeChatsReq'
    ])
  })

  it('AppModeSwitch.vue 源码认证成功后才进入客服端', () => {
    // eslint-disable-next-line global-require
    const fs = require('fs')
    // eslint-disable-next-line global-require
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AppModeSwitch.vue'),
      'utf8'
    )
    assertMobileAdminSource(source)
  })
})
