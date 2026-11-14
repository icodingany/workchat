import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 003 账号融合：密码登录迁到个微（wei-kefu-be）主数据端。
 *
 * masterAuthApi 必须满足：
 * - 独立 axios 实例，baseURL 取 VUE_APP_MASTER_FETCH_URL（个微端与企聊端不同服务，
 *   不能走 utils/fetch 的 VUE_APP_FETCH_URL/token 路由——先例：utils/upload.js）
 * - /user/login 表单编码 POST（后端 @RequestParam），不带任何本端 token 头
 * - resolve 的是响应体 ResultInfo（{code,msg,data}），调用方只消费 data.token
 * - baseUrl 可经 createMasterAuthApi 注入：vitest 会把 process.env.VUE_APP_*
 *   静态替换为 .env.test 常量，stubEnv 无法覆盖，测试须显式传参
 */

const { createStub, postStub } = vi.hoisted(() => {
  const postStub = vi.fn()
  const createStub = vi.fn(() => ({ post: postStub }))
  return { createStub, postStub }
})

vi.mock('axios', () => ({ default: { create: createStub } }))

async function loadModule() {
  vi.resetModules()
  return await import('@/api/masterAuthApi')
}

describe('masterAuthApi（个微主数据端登录）', () => {
  beforeEach(() => {
    postStub.mockReset()
  })

  it('用 VUE_APP_MASTER_FETCH_URL 创建默认实例（去尾斜杠）', async () => {
    await loadModule()
    // vitest 下该值为 .env.test 静态替换结果（apitest）；至少非空且无尾斜杠
    const cfg = createStub.mock.calls[0][0]
    expect(cfg.baseURL).toBe(cfg.baseURL.replace(/\/+$/, ''))
    expect(cfg.baseURL).not.toBe('')
  })

  it('createMasterAuthApi 显式注入 baseUrl 时同样去尾斜杠', async () => {
    await loadModule()
    const { createMasterAuthApi } = await import('@/api/masterAuthApi')
    createStub.mockClear()
    const api = createMasterAuthApi('http://127.0.0.1:18080/')
    expect(api.baseURL).toBe('http://127.0.0.1:18080')
    expect(createStub.mock.calls[0][0].baseURL).toBe('http://127.0.0.1:18080')
  })

  it('masterLogin 表单编码 POST /user/login，不带 token 头', async () => {
    await loadModule()
    postStub.mockResolvedValue({ data: { code: 0, msg: 'success', data: { token: 'jwt' } } })

    const { masterLogin } = await import('@/api/masterAuthApi')
    const res = await masterLogin('demo_customer', 'customer-demo-password')

    expect(postStub).toHaveBeenCalledTimes(1)
    const [url, body] = postStub.mock.calls[0]
    expect(url).toBe('/user/login')
    expect(body).toBe('account=demo_customer&password=customer-demo-password')
    // post 表单头在实例级设置（对齐 utils/fetch.js 惯例），且实例不注入任何本端 token
    const cfg = createStub.mock.calls[0][0]
    expect(cfg.headers.post['Content-Type']).toContain('application/x-www-form-urlencoded')
    expect(cfg.headers.token).toBeUndefined()
    expect(cfg.headers.Authorization).toBeUndefined()
    expect(res).toEqual({ code: 0, msg: 'success', data: { token: 'jwt' } })
  })

  it('个微 code=-1（账号或密码错误）原样 resolve，由调用方按两步登录语义提示', async () => {
    await loadModule()
    postStub.mockResolvedValue({ data: { code: -1, msg: '账号或密码错误', data: null } })

    const { masterLogin } = await import('@/api/masterAuthApi')
    const res = await masterLogin('demo_customer', 'bad')
    expect(res.code).toBe(-1)
    expect(res.msg).toBe('账号或密码错误')
  })

  it('baseUrl 未配置时工厂不抛错（masterApiBaseUrl 返回空串，调用方须先判空）', async () => {
    await loadModule()
    const { createMasterAuthApi, masterApiBaseUrl } = await import('@/api/masterAuthApi')
    createStub.mockClear()
    const api = createMasterAuthApi('')
    expect(api.baseURL).toBe('')
    expect(masterApiBaseUrl()).not.toBeUndefined()
  })
})
