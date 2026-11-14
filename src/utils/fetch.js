/**
 * Axios 封装 - HTTP 请求工具
 * <p>
 * 基于 axios 封装的统一 HTTP 请求工具，提供：
 * <ul>
 *   <li>请求拦截：自动添加 token 到请求头</li>
 *   <li>响应拦截：统一处理错误状态码</li>
 *   <li>错误处理：401 跳转登录、403 提示过期等</li>
 *   <li>请求方法：get、post、put、patch、delete、postJson</li>
 * </ul>
 * <p>
 * <b>配置说明：</b>
 * <pre>
 * - 请求超时：10000ms
 * - 基础 URL：从环境变量 VUE_APP_FETCH_URL 读取
 * - POST 请求头：application/x-www-form-urlencoded
 * - 支持 JWT token 认证
 * </pre>
 */

// 序列化工具：将对象转换为 URL 编码字符串
import qs from 'qs'
// 引入axios
import axios from 'axios'
// 引入路由
import router from '../router'
// 引入vuex
import store from '../store'
// UI 组件：消息提示框
import { ElMessageBox as MessageBox } from 'element-plus'
import { resolveFetchAuthHeaders } from './fetchTokenRouting'

/**
 * 会话过期统一收口：清凭证 → 跳登录页（App.vue 的 httpToken watcher 会再整页 reload）。
 * <p>
 * 触发来源有二：HTTP 401，以及后端把 token 失效包成 HTTP 200 +
 * {"code":-1,"msg":"...请重新登录"} 的业务信封（如 /user/account/pageList 返回
 * 「无法获取客户信息，请重新登录」）。旧代码只按 HTTP 状态码处理，残留过期
 * httpToken 的用户会被路由守卫放进管理端，首个接口 200+code:-1 又无人消费，
 * 用户就停在「暂无数据」的空页面（发版/过期后表现为页面坏了）。
 * <p>
 * 5 秒去重：并发请求同时失效时只处理一次。
 */
let sessionExpiredHandledAt = 0

function isOnLoginPage() {
    const current = router.currentRoute && router.currentRoute.value
    return !!(current && current.path === '/login')
}

/** 正在跳转登录页：调用方 catch 里不要再弹业务错误 toast */
export function isLeavingToLogin() {
    return isOnLoginPage()
}

/** 后端业务信封是否表示会话过期（code:-1 且 msg 为重新登录/登录过期类文案） */
function isSessionExpiredBody(body) {
    return (
        body &&
        typeof body === 'object' &&
        Number(body.code) === -1 &&
        typeof body.msg === 'string' &&
        /重新登录|重新登陆|登录(已)?过期|token过期/.test(body.msg)
    )
}

function handleSessionExpired() {
    const now = Date.now()
    if (now - sessionExpiredHandledAt < 5000) return
    // vue-router 4 的 currentRoute 是 ref；旧代码按 v3 取 .fullPath 恒为 undefined
    if (isOnLoginPage()) return
    sessionExpiredHandledAt = now
    try {
        localStorage.removeItem('httpToken')
    } catch (e) {}
    // SET_HTTP_TOKEN 置空会连带清掉 adminInfo；App.vue 的 watcher 随之
    // replace(/login) + reload（登出语义，顺带清空内存态），App 未挂载的
    // 边缘场景（如登录页接口过期）由下面的 replace 兜底
    store.commit('SET_HTTP_TOKEN', '')
    router.replace({ path: '/login' }).catch(() => {})
}

/**
 * 请求失败后的错误统一处理
 * <p>
 * 根据 HTTP 状态码进行不同的错误处理：
 * <ul>
 *   <li>401：未登录，清凭证并跳转登录页面</li>
 *   <li>403：权限不足（登录页不弹窗）</li>
 *   <li>404：请求不存在</li>
 *   <li>其他：显示通用错误提示</li>
 * </ul>
 *
 * @param {Number} status 请求失败的状态码
 * @param {String} errMsg 错误信息
 */
const errorHandle = (status, errMsg) => {
    if (isOnLoginPage()) return
    switch (status) {
        // 401: 未登录 → 清掉过期凭证后回登录页（登录成功后可按 query.redirect 返回）
        case 401:
            handleSessionExpired()
            break
        // 403 token过期
        // 登录过期对用户进行提示
        // 清除本地token和清空vuex中token对象
        // 跳转登录页面
        case 403:
            // 登录页不弹窗；业务页 403 多为权限不足（非 token 过期）
            if (isOnLoginPage()) break
            MessageBox.alert(`无权限访问该功能`, '提示', {
                type: 'warning',
                confirmButtonText: '确定'
            })
            break
        // 404请求不存在
        case 404:
            MessageBox.alert(`网络请求不存在`, '错误信息', {
                type: 'error',
                confirmButtonText: '确定'
            })
            break
        // 其他错误，直接抛出错误提示
        default:
            MessageBox.alert(`状态码:${status},错误信息:${errMsg}`, '错误信息', {
                type: 'error',
                confirmButtonText: '确定'
            })
    }
}

// 配置方法的优先级是 axios请求配置 > axios实例配置 > axios全局配置

/**
 * axios 全局配置
 */
axios.defaults.timeout = 10000 // 请求超时时间：10秒

// 请求的域名，基本地址（从环境变量读取）
axios.defaults.baseURL = process.env.VUE_APP_FETCH_URL
// 环境的切换
// if (process.env.NODE_ENV === 'development') {
//   axios.defaults.baseURL = baseUrlDev || 'http://192.0.2.10:13086'
// } else if (process.env.NODE_ENV === 'debug') {
//   axios.defaults.baseURL = ''
// } else if (process.env.NODE_ENV === 'production') {
//   axios.defaults.baseURL = baseUrl
// }
// post请求头
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'

/**
 * 创建 axios 实例
 * <p>
 * 如果需要访问多个服务地址，而这些服务请求和响应的结构也可能都完全不同，
 * 那么你可以通过 axios.create 创建不同的实例来处理。
 */
const httpInstance = axios.create({
    // url: "/data.json", // 请求的路径
    // baseURL: "http://localhost:8080", // 请求的域名，基本地址
    timeout: 10000, // 请求的超时时长，单位毫秒
    method: 'get,post,put,patch,delete', // 请求方法
    withCredentials: true, // 跨域携带凭证
    params: {}, // 请求参数拼接在URL上
    data: {} // 请求参数放在请求体里
})
// // 设置post请求头
// httpInstance.defaults.headers.post["Content-Type"] =
//   "application/x-www-form-urlencoded; charset=UTF-8"

/**
 * 请求拦截器
 * <p>
 * 每次请求前，如果存在 token 则在请求头中携带 token。
 * <p>
 * <b>支持两种 token 模式：</b>
 * <ul>
 *   <li>JWT Bearer token：Authorization: Bearer {token}</li>
 *   <li>自定义 token：token: {token}</li>
 * </ul>
 */
httpInstance.interceptors.request.use(
    (config) => {
        // 在发送请求之前做些什么
        // 登录流程控制中，根据本地是否存在token判断用户的登录情况
        // 但是即使token存在，也有可能token是过期的，所以在每次的请求头中携带token
        // 后台根据携带的token判断用户的登录情况，并返回给我们对应的状态码
        // 而后我们可以在响应拦截器中，根据状态码进行一些统一的操作。
        //
        // 鉴权说明：
        //   - /admin/**、/user/**：用 httpToken（/user/login 返回的 JWT）。
        //     后端 LoginContext 只认 JWT（claims.userId）；WS DeviceAuthRsp.AccessToken
        //     是 netty channel id，不是 JWT。若优先带 WS token，queryByCid 等会鉴权失败、
        //     操作员下拉为空。
        //   - /pc/** 等其余：优先 httpToken，再回退 validateToken / webSocketToken。
        // httpToken 优先从 localStorage 取（防刷新丢失），再回退 vuex。
        const url = config.url || ''
        const httpToken = localStorage.getItem('httpToken') || store.state.httpToken
        const authHeaders = resolveFetchAuthHeaders(url, {
            httpToken,
            validateToken: localStorage.getItem('validateToken'),
            webSocketToken: store.state.webSocketToken
        })
        if (authHeaders.Authorization) {
            config.headers.Authorization = authHeaders.Authorization
        }
        if (authHeaders.token) {
            config.headers.token = authHeaders.token
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

/**
 * 响应拦截器
 * <p>
 * 后端验证 token 失败后跳转到登录界面。
 * <p>
 * <b>处理逻辑：</b>
 * <ul>
 *   <li>状态码 200：返回 Promise.resolve(response)</li>
 *   <li>其他状态码：返回 Promise.reject(response)</li>
 *   <li>有 response 时：调用 errorHandle 统一处理</li>
 * </ul>
 */
httpInstance.interceptors.response.use(
    (response) => {
        // 如果返回的状态码为200，说明接口请求成功，可以正常拿到数据
        // 否则的话抛出错误
        if (response.status === 200) {
            // 后端 token 失效多数走 200 + code:-1 +「请重新登录」信封（见 errorHandle 注释），
            // 业务码过期在此统一收口；其余 code 交由各调用方按 res.code 自行处理
            if (isSessionExpiredBody(response.data)) {
                handleSessionExpired()
            }
            return Promise.resolve(response)
        } else {
            return Promise.reject(response)
        }
    },
    (error) => {
        // 服务器状态码不是2开头的的情况
        // 这里可以跟你们的后台开发人员协商好统一的错误状态码
        // 然后根据返回的状态码进行一些操作，例如登录过期，错误提示等等。
        // 注：错误详情在 error.response.data（axios 的 error 上没有 error.data，
        // 旧代码误判条件导致 401/403 分支从未执行过）
        if (error.response && error.response.status) {
            const body = error.response.data
            errorHandle(error.response.status, body && body.message)
            return Promise.reject(error.response)
        } else {
            console.log('响应拦截器-请求失败', error)
            return Promise.reject(error)
            // 处理断网的情况
            // eg:请求超时或断网时，更新state的network状态
            // network状态在app.vue中控制着一个全局的断网提示组件的显示隐藏
            // 关于断网组件中的刷新重新获取数据，会在断网组件中说明
            // store.commit("changeNetwork", false)
        }
    }
)

/**
 * 核心请求方法
 * <p>
 * 根据请求方法类型处理参数：
 * <ul>
 *   <li>GET/DELETE：参数放在 params（URL 查询字符串）</li>
 *   <li>POST/PUT/PATCH：参数放在 data（请求体）</li>
 * </ul>
 *
 * @param {String} method HTTP 请求方法
 * @param {String} url 请求地址
 * @param {Object} params 请求参数
 * @returns {Promise} 返回 Promise 对象
 */
function apiAxios(method, url, params) {
    return new Promise((resolve, reject) => {
        httpInstance({
            url: url,
            method: method,
            // baseURL: 'http://192.0.2.10:10010', // 开发模式下vue-cli已经配置了请求转发，所以不用基础路径即可
            params: method === 'GET' || method === 'DELETE' ? params : null,
            paramsSerializer: (params) => {
                return qs.stringify(params, { indices: false })
            },
            data: method !== 'GET' && method !== 'DELETE' ? qs.stringify(params) : null
        })
            .then((res) => {
                if (res.data) {
                    resolve(res.data)
                } else {
                    resolve(res)
                }
            })
            .catch((err) => {
                reject(err)
            })
    })
}

/**
 * 导出请求方法
 * <p>
 * 提供多种 HTTP 请求方法的快捷封装：
 * <ul>
 *   <li>get(url, params)：GET 请求</li>
 *   <li>post(url, params)：POST 请求（表单编码）</li>
 *   <li>postJson(url, params)：POST 请求（JSON 格式）</li>
 *   <li>put(url, params)：PUT 请求</li>
 *   <li>patch(url, params)：PATCH 请求</li>
 *   <li>delete(url, params)：DELETE 请求</li>
 * </ul>
 */
export default {
    get: function(url, params) {
        return apiAxios('GET', url, params)
    },
    post: function(url, params) {
        return apiAxios('POST', url, params)
    },
    /**
     * POST JSON 请求
     * <p>
     * 直接发送 JSON 格式的请求体，不进行表单编码。
     * 适用于需要发送复杂数据结构的场景。
     */
    postJson: function(url, params) {
        return new Promise((resolve, reject) => {
            httpInstance({
                url: url,
                method: 'POST',
                data: params,
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then((res) => {
                    resolve(res.data)
                })
                .catch((err) => {
                    reject(err)
                })
        })
    },
    put: function(url, params) {
        return apiAxios('PUT', url, params)
    },
    patch: function(url, params) {
        return apiAxios('PATCH', url, params)
    },
    delete: function(url, params) {
        return apiAxios('DELETE', url, params)
    }
}
