/**
 * 个微（客徕徕）主数据端登录接口（wei-kefu-be）。
 *
 * 003 账号融合：企聊端不再自持密码登录——密码校验统一走个微端 /user/login，
 * 拿到个微 access token 后仍由本端 wework-server /user/sso/login 兑换本端
 * 登录态（WS「JWT 当密码」通道只认本端 token，见 WsJwtCredentialService）。
 *
 * 个微端与企聊端是不同服务，故用独立 axios 实例指向 VUE_APP_MASTER_FETCH_URL
 * （先例：utils/upload.js 的第二 base），不复用 utils/fetch——后者的 token 路由
 * 与 401 跳登录都是本端语义，登录请求本就无 token，错误由调用方按两步登录
 * 语义提示（第①步失败=账号或密码错误，第②步失败=开通/同步问题原样展示）。
 *
 * 注意：vitest/vite 会把 process.env.VUE_APP_* 静态替换为构建期常量，
 * 故暴露 createMasterAuthApi(baseUrl) 工厂供测试显式注入地址。
 */
import axios from 'axios'
import qs from 'qs'

/**
 * 创建个微端登录 API。一般直接用默认导出的 masterLogin/masterApiBaseUrl；
 * 测试或特殊部署可传自定义 baseUrl（去尾斜杠）。
 * @param {string} baseUrl 个微端 API 根地址（如 http://127.0.0.1:18080）
 */
export function createMasterAuthApi(baseUrl) {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '')
  // post 表单头在实例级设置（对齐 utils/fetch.js 惯例），且实例不注入任何本端 token
  const http = axios.create({
    baseURL: normalizedBase,
    timeout: 10000,
    withCredentials: true,
    headers: {
      post: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    }
  })

  return {
    baseURL: normalizedBase,
    /**
     * 个微端密码登录。resolve 的是响应体 ResultInfo：{ code, msg, data }。
     * 只消费 data.token——个微 LoginVO 的 type/kid 语义与企聊端不同，禁止直接使用。
     * @param {string} account 个微账号
     * @param {string} password 个微密码
     */
    masterLogin(account, password) {
      return http
        .post('/user/login', qs.stringify({ account: account, password: password }))
        .then((res) => res.data)
    }
  }
}

const defaultApi = createMasterAuthApi(process.env.VUE_APP_MASTER_FETCH_URL)

/** 供调用方判断是否已配置个微端地址（空串=未配置，两步登录第一步前须判空） */
export function masterApiBaseUrl() {
  return defaultApi.baseURL
}

export const masterLogin = defaultApi.masterLogin
