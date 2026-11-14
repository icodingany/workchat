import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

/**
 * 身份托管（账号由客徕徕系统统一管理）下管理端只读展示的回归：
 * AccountManagement / SuperCustomerManagement 必须按 identityConfig.managedExternally
 * 隐藏本地增删改入口并展示客徕徕引导提示，且不影响列表查询本身。
 */
function read(rel) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')
}

describe('admin identity managed (客徕徕托管) UI gating', () => {
  const account = read('src/views/admin/components/AccountManagement.vue')
  const customer = read('src/views/admin/components/SuperCustomerManagement.vue')

  it('账号管理：添加按钮与操作列受 identityManaged 控制', () => {
    expect(account).to.include('identityManaged')
    // 添加按钮隐藏 + 托管提示
    expect(account).to.match(/v-if="!identityManaged"[^>]*@click="showDialog"/)
    expect(account).to.include('由客徕徕系统统一管理')
    // 操作列（修改/删除）整体隐藏
    const colIdx = account.indexOf('label="操作"')
    expect(colIdx).to.be.at.least(0)
    const before = account.slice(Math.max(0, colIdx - 120), colIdx)
    expect(before).to.include('v-if="!identityManaged"')
  })

  it('账号管理：挂载时拉取 identityConfig，查询不受托管影响', () => {
    expect(account).to.include('queryIdentityConfig')
    expect(account).to.include('loadIdentityConfig()')
    // 查询按钮不挂 v-if
    expect(account).to.match(/@click="queryData"([^>]*)>(?!<\/)/)
  })

  it('客户管理：添加按钮与操作列受 identityManaged 控制', () => {
    expect(customer).to.include('identityManaged')
    expect(customer).to.match(/v-if="!identityManaged"[^>]*@click="showDialog"/)
    expect(customer).to.include('由客徕徕系统统一管理')
    const colIdx = customer.indexOf('label="操作"')
    expect(colIdx).to.be.at.least(0)
    const before = customer.slice(Math.max(0, colIdx - 120), colIdx)
    expect(before).to.include('v-if="!identityManaged"')
  })

  it('API 层提供 identityConfig 封装（POST /user/account/identityConfig）', () => {
    const api = read('src/api/httpApiAdmin.js')
    expect(api).to.include("'/user/account/identityConfig'")
    expect(api).to.include('export function queryIdentityConfig')
  })
})
