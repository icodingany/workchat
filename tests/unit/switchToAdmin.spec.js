/**
 * 切管理端时的补登决策（对标 AppModeSwitch.switchTo('admin')）
 */
import { expect } from 'chai'

function planSwitchToAdmin(input) {
  const steps = []
  if (!input.hasHttpToken) {
    steps.push('ensureAdminHttpLogin')
  }
  steps.push('SET_ACTIVE_PANEL:admin')
  steps.push('router.replace:admin')
  return { steps }
}

describe('switchToAdmin navigation plan', () => {
  it('无 httpToken 时先补登 HTTP，再进管理端', () => {
    const plan = planSwitchToAdmin({ hasHttpToken: false })
    expect(plan.steps[0]).to.equal('ensureAdminHttpLogin')
    expect(plan.steps).to.include('SET_ACTIVE_PANEL:admin')
  })

  it('已有 httpToken 时直接进管理端', () => {
    const plan = planSwitchToAdmin({ hasHttpToken: true })
    expect(plan.steps).to.not.include('ensureAdminHttpLogin')
    expect(plan.steps[0]).to.equal('SET_ACTIVE_PANEL:admin')
  })

  it('AppModeSwitch.vue 源码：无 httpToken 时调用 ensureAdminHttpLogin', () => {
    // eslint-disable-next-line global-require
    const fs = require('fs')
    // eslint-disable-next-line global-require
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AppModeSwitch.vue'),
      'utf8'
    )
    expect(source).to.include('ensureAdminHttpLogin')
    expect(source).to.not.include("this.$message.warning('无管理端权限')")
  })
})
