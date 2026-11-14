import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

/**
 * 003 账号融合回归：密码登录迁到个微端（wei-kefu-be）。
 *
 * - LoginPage 两步登录：① masterLogin（个微 /user/login）→ ② ssoLogin（本端兑换），
 *   不再直接调用本端 /user/login；WS 凭证存本端 JWT（sessionPwdOfJuboChat）。
 * - VUE_APP_MASTER_FETCH_URL 各 env 齐备（web/electron/test）。
 * - 密码由客徕徕统一管理（identityManaged）时，三处修改密码入口隐藏。
 *
 * 沿用本仓源码断言惯例（对齐 adminIdentityManaged.spec.js / wsAuthHandoff.spec.js）：
 * LoginPage 依赖 store/router/WebSocket 编译链，直接挂载成本高，故锁关键源码结构。
 */
function read(rel) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')
}

describe('master login flow（003 账号融合：两步登录）', () => {
  const loginPage = read('src/views/LoginPage.vue')

  it('LoginPage 走两步登录：masterLogin 在前，ssoLogin 兑换在后', () => {
    expect(loginPage).to.include("from '../api/masterAuthApi'")
    const idxMaster = loginPage.indexOf('masterLogin(submitName, submitPass)')
    const idxSso = loginPage.indexOf('ssoLogin(masterRes.data.token)')
    expect(idxMaster).to.be.at.least(0)
    expect(idxSso).to.be.at.least(0)
    expect(idxSso).to.be.greaterThan(idxMaster)
  })

  it('LoginPage 不再直接调本端 /user/login（login 从 httpApiAdmin import 已移除）', () => {
    expect(loginPage).to.not.match(/import\s*\{[^}]*\blogin\b[^}]*\}\s*from\s*'..\/api\/httpApiAdmin'/)
  })

  it('WS 凭证存本端 JWT（sessionPwdOfJuboChat ← 兑换出的 token），真实密码不进 sessionStorage', () => {
    expect(loginPage).to.include("sessionStorage.setItem('sessionPwdOfJuboChat', localToken)")
    // 旧实现：sessionPwd 存明文密码 —— 不得回退
    expect(loginPage).to.not.include("sessionStorage.setItem('sessionPwdOfJuboChat', submitPass)")
  })

  it('个微端地址未配置时可读提示，不发起登录', () => {
    expect(loginPage).to.include('未配置个微登录地址')
  })

  it('SSO 兑换失败原样展示（如「该客徕徕账号未开通企聊客服」）', () => {
    expect(loginPage).to.include('this.finishLoginFailure(res.msg')
  })

  it('各 env 文件均配置 VUE_APP_MASTER_FETCH_URL（web/electron/test）', () => {
    const cases = [
      ['.env.development', 'http://127.0.0.1:18080'],
      ['.env.production', 'http://127.0.0.1:18080'],
      ['.env.stage', 'http://127.0.0.1:18080'],
      ['.env.development.electron', 'http://127.0.0.1:18080'],
      ['.env.production.electron', 'http://127.0.0.1:18080'],
      ['.env.test', 'http://127.0.0.1:18080']
    ]
    cases.forEach(([file, url]) => {
      expect(read(file), file).to.include('VUE_APP_MASTER_FETCH_URL')
      expect(read(file), file).to.include(url)
    })
    // vite-env-defines 干净发布目录兜底默认值
    expect(read('scripts/vite-env-defines.cjs')).to.include(
      "VUE_APP_MASTER_FETCH_URL: 'http://127.0.0.1:18080'"
    )
  })
})

describe('identityManaged 修改密码门控（密码由客徕徕统一管理）', () => {
  const surfaces = [
    'src/components/HeaderPage.vue',
    'src/views/admin/index.vue',
    'src/views/mobile/views/admin.vue'
  ]

  it('三处修改密码入口都按 identityManaged 隐藏，且挂载时拉取 identityConfig', () => {
    surfaces.forEach((f) => {
      const src = read(f)
      expect(src, f).to.include('identityManaged')
      expect(src, f).to.include('queryIdentityConfig')
      expect(src, f).to.include('managedExternally')
    })
  })

  it('门控元素绑定 v-if="!identityManaged"', () => {
    expect(read(surfaces[0])).to.match(/v-if="!identityManaged"[^>]*command="modifyPwd"/)
    expect(read(surfaces[1])).to.match(/v-if="!identityManaged"[^>]*command="modifyPwd"/)
    expect(read(surfaces[2])).to.match(/v-if="!identityManaged"[^>]*title="修改密码"/)
  })
})
