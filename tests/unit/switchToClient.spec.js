/**
 * 切客服端时的导航决策（对标 AppModeSwitch.switchTo('client')）
 * <p>
 * 直接 import AppModeSwitch.vue 会拉 SCSS/整链，故抽纯函数测决策表。
 * 若 AppModeSwitch 改动进入客服端逻辑，需同步本文件。
 *
 * <b>期望：</b>进入客服端必须落到 /conversation（聚合聊天），且应先导航再切面板，
 * 避免仍停在 /admin 时 HeaderPage 无选中项、main 命名视图为空。
 */
import { expect } from 'chai'

/**
 * 与 AppModeSwitch.switchTo('client') 保持同序。改组件时务必同步本函数。
 * @param {{ routePath: string, routeName?: string, hasWsToken: boolean }} input
 * @returns {{ steps: string[], finalPath: string }}
 */
function planSwitchToClient(input) {
  const steps = []
  let path = input.routePath
  const name = input.routeName || ''

  if (!input.hasWsToken) {
    steps.push('ensureClientWsLogin')
  }

  // 必须先导航到聚合聊天，再切面板（避免仍停在 /admin 时顶栏无选中）
  const alreadyConversation = path === '/conversation' || name === 'conversation'
  if (!alreadyConversation) {
    steps.push('router.replace:/conversation')
    path = '/conversation'
  }
  steps.push('SET_ACTIVE_PANEL:client')
  steps.push('GetWeChatsReq')

  return { steps, finalPath: path }
}

/** 用源码字符串校验 AppModeSwitch 真实顺序（防纯函数与源码漂移） */
function assertAppModeSwitchNavigatesBeforePanel(source) {
  const clientBlock = source.slice(
    source.indexOf("if (panel === 'client')"),
    source.indexOf("this.$store.commit('SET_ACTIVE_PANEL', panel)")
  )
  const replaceIdx = clientBlock.indexOf("replace({ path: '/conversation' })")
  const panelIdx = clientBlock.indexOf("SET_ACTIVE_PANEL', 'client'")
  expect(replaceIdx, 'client 分支应包含 replace /conversation').to.be.at.least(0)
  expect(panelIdx, 'client 分支应 SET_ACTIVE_PANEL client').to.be.at.least(0)
  expect(replaceIdx, '应先 replace 到聚合聊天，再 SET_ACTIVE_PANEL').to.be.lessThan(panelIdx)
}

describe('switchToClient navigation plan', () => {
  it('从管理端 /admin 进入客服端：最终路径为 /conversation，且先 replace 再切面板', () => {
    const plan = planSwitchToClient({
      routePath: '/admin',
      routeName: 'admin',
      hasWsToken: true
    })
    expect(plan.finalPath).to.equal('/conversation')
    expect(plan.steps[0]).to.equal('router.replace:/conversation')
    const replaceIdx = plan.steps.indexOf('router.replace:/conversation')
    const panelIdx = plan.steps.indexOf('SET_ACTIVE_PANEL:client')
    expect(replaceIdx).to.be.lessThan(panelIdx)
  })

  it('无 WS token 时先补登，再导航到聚合聊天', () => {
    const plan = planSwitchToClient({
      routePath: '/admin',
      routeName: 'admin',
      hasWsToken: false
    })
    expect(plan.steps[0]).to.equal('ensureClientWsLogin')
    expect(plan.finalPath).to.equal('/conversation')
    const replaceIdx = plan.steps.indexOf('router.replace:/conversation')
    const panelIdx = plan.steps.indexOf('SET_ACTIVE_PANEL:client')
    expect(replaceIdx).to.be.lessThan(panelIdx)
  })

  it('AppModeSwitch.vue 源码：进入客服端先 replace /conversation 再 SET_ACTIVE_PANEL', () => {
    // eslint-disable-next-line global-require
    const fs = require('fs')
    // eslint-disable-next-line global-require
    const path = require('path')
    // mochapack 下 __dirname 不可靠，用 cwd（vue-cli-service 在项目根执行）
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AppModeSwitch.vue'),
      'utf8'
    )
    assertAppModeSwitchNavigatesBeforePanel(source)
  })

  it('AppModeSwitch.vue 源码：已在 client 但非聚合聊天时不得整体 early-return', () => {
    // eslint-disable-next-line global-require
    const fs = require('fs')
    // eslint-disable-next-line global-require
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AppModeSwitch.vue'),
      'utf8'
    )
    // 旧逻辑：if (activePanel === panel && (panel !== 'client' || webSocketToken)) return
    // 会在 client+#/admin 时直接 return，永远纠正不了路由
    expect(source).to.not.match(
      /activePanel === panel && \(panel !== 'client' \|\| this\.webSocketToken\)\) return/
    )
    expect(source).to.include('onConversation')
  })
})
