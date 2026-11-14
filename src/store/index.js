/**
 * Vuex 全局状态管理
 * <p>
 * workchat 的全局状态管理中心，使用 Vuex 模块化架构。
 * <p>
 * <b>模块结构：</b>
 * <pre>
 * store/
 * ├── index.js          # 根 store（本文件）
 * └── modules/
 *     ├── websocket.js  # WebSocket 相关状态和操作
 *     ├── conversation.js # 会话、联系人、聊天记录
 *     ├── circle.js     # 朋友圈相关
 *     ├── groupSend.js  # 群发任务相关
 *     ├── tools.js      # 工具功能相关
 *     └── nedb.js       # 本地数据库操作
 * </pre>
 * <p>
 * <b>全局状态：</b>
 * <ul>
 *   <li>currentMode：运行模式（web/electron）</li>
 *   <li>webSocketState：WebSocket 连接状态（0-3）</li>
 *   <li>webSocketToken：WebSocket 认证 token</li>
 *   <li>currentUser：当前登录用户信息</li>
 *   <li>clientOrServer：客户端还是管理端</li>
 *   <li>adminInfo：管理员信息</li>
 *   <li>httpToken：管理端返回的 HTTP token</li>
 * </ul>
 */
import { createStore } from 'vuex'
import { ElMessage as Message } from 'element-plus'
import router from '@/router'
import modules from './modules'
import { isSuperAdminFromState } from '../utils/superAdmin'

const defaultUnifiedLogin = () => ({
    pending: false,
    wsFailed: false,
    httpDone: false,
    httpOk: false,
    /** SSO 入口指定去向：'client'=强制进客服端（kelai 管理端「企微客服端」入口）；''=按账号类型默认 */
    entry: ''
})

const ADMIN_INFO_KEY = 'adminInfo'

/** 从 localStorage 恢复 adminInfo（无 httpToken 时丢弃，避免脏数据） */
function loadAdminInfo() {
    if (typeof localStorage === 'undefined') return {}
    if (!localStorage.getItem('httpToken')) {
        localStorage.removeItem(ADMIN_INFO_KEY)
        return {}
    }
    try {
        const raw = localStorage.getItem(ADMIN_INFO_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return {}
        delete parsed.password
        return parsed
    } catch (e) {
        return {}
    }
}

function persistAdminInfo(info) {
    if (typeof localStorage === 'undefined') return
    if (!info || typeof info !== 'object') {
        localStorage.removeItem(ADMIN_INFO_KEY)
        return
    }
    const safe = { ...info }
    delete safe.password
    localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(safe))
}

/**
 * 根状态
 * <p>
 * 存储应用级别的全局状态，不归属于任何特定模块。
 */
const state = {
    /** 当前的运行环境：'web' 或 'electron' */
    currentMode: 'web',

    /** WebSocket 连接状态：0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED */
    webSocketState: 0,

    /** WebSocket 认证 token，用于与服务端通信 */
    webSocketToken: '',

    /** 当前登录用户的信息对象 */
    currentUser: {},

    /** 客户端类型：'client'=客户端, 'server'=管理端 */
    clientOrServer: 'client',

    /**
     * 管理员/操作员 HTTP 登录信息（含 nickname）
     * <p>
     * 与 httpToken 一并从 localStorage 恢复，避免刷新后顶栏昵称丢失。
     */
    adminInfo: loadAdminInfo(),

    /**
     * HTTP 请求 token（管理端 API 认证）
     * <p>
     * 初始值从 localStorage 恢复，避免刷新页面后 vuex 状态丢失导致 /admin/** 接口 401。
     */
    httpToken: (typeof localStorage !== 'undefined' && localStorage.getItem('httpToken')) || '',

    /**
     * 当前主界面面板：'client'=客服端, 'admin'=管理端
     * <p>
     * 借鉴 kelailaichatpc：登录后统一主页面，右上角 tab 切换，不互相登出。
     */
    activePanel:
        (typeof localStorage !== 'undefined' && localStorage.getItem('activePanel')) || 'client',

    /** 统一登录协调：客服端 WebSocket + 管理端 HTTP 并行鉴权 */
    unifiedLogin: defaultUnifiedLogin(),

    /** 侧边栏勾选后优先显示设备备注（对齐 kelailaichatpc showDevNick） */
    showDevNick:
        typeof localStorage !== 'undefined' && localStorage.getItem('showDevNick') === '1'
}

/**
 * 全局 getters
 * <p>
 * 提供对 state 的计算属性访问。
 */
const getters = {
    /** Element UI 上传组件的 action 地址 */
    actionUrl: () => process.env.VUE_APP_UPLOAD_URL,

    /** WebSocket 认证 token */
    webSocketToken: (state) => state.webSocketToken,

    /** 当前登录用户信息 */
    currentUser: (state) => state.currentUser,

    /** HTTP 管理端登录的账号信息（含 account / nickname） */
    adminInfo: (state) => state.adminInfo || {},

    /**
     * 用户唯一 ID（账号 UnionId，全局唯一；不再用数字 cid 组合）
     */
    userId: (state) => (state.currentUser && state.currentUser.UnionId) || '',

    /** 当前运行环境模式 */
    currentMode: (state) => state.currentMode,

    /** 是否桌面壳（electron 过渡期 / tauri） */
    isDesktop: (state) => state.currentMode === 'electron' || state.currentMode === 'tauri',

    /**
     * 是否为超级管理员（type === -1）。
     * adminInfo.type 优先；缺失时回退 httpToken JWT 的 type claim。
     */
    superAdmin: (state) => isSuperAdminFromState(state.adminInfo, state.httpToken),

    /** 侧边栏是否优先显示设备备注 */
    showDevNick: (state) => state.showDevNick
}

/**
 * 全局 actions
 * <p>
 * 根级别的异步操作，当前为空。
 * 具体业务逻辑在各模块的 actions 中实现。
 */
const actions = {
    /**
     * 统一登录收尾：WebSocket 与 HTTP 都已有结果后决定进入客服端还是管理端
     * <p>
     * 路由决策（按账号 type）：
     * <ul>
     *   <li>type=-1/0/1（超管/公司管理员/普通管理员）+ HTTP 登录成功 → 进 admin 管理端</li>
     *   <li>type=2（普通员工）或 HTTP 失败 → 进 client 客服端</li>
     * </ul>
     * SSO 入口可携带 entry=client 覆盖上述默认（强制进客服端，kelai 管理端
     * 「企微客服端」入口）；仅 WS 成功分支生效，WS 失败仍按默认兜底（无 WS 的
     * 聚合聊天页不可用）。
     * 时序协调：WS 先到时若 HTTP 还没结果，等 HTTP；HTTP 先到时若 WS 还没结果，
     * 等 WS（HTTP 失败除外）。任一一侧完成后都会 dispatch 本 action，
     * 由 pending 状态保证只决策一次。
     */
    tryCompleteUnifiedLogin({ state, commit }) {
        const ul = state.unifiedLogin
        if (!ul.pending) return

        // 判断当前账号是否应进 admin（type=-1 超管 / 0 公司管理员 / 1 普通管理员）
        // 注意 adminInfo 可能为 null（操作员或未登录态），Number(null)===0 会误判为管理员，
        // 必须先判 adminInfo 存在；同时兼容字符串类型（后端 type 可能序列化成 "0"/"-1"）
        const ai = state.adminInfo
        const t = ai != null ? Number(ai.type) : NaN
        const isAdminType = t === -1 || t === 0 || t === 1

        // WebSocket 已成功的分支
        if (state.webSocketToken) {
            // 管理员账号（或 SSO entry=admin 强制，客徕徕企微管理菜单深链）：
            // 必须等 HTTP 也完成才能决策（HTTP 失败也要走 client 兜底）
            const forceAdmin = ul.entry === 'admin'
            if ((isAdminType || forceAdmin) && !ul.httpDone) return

            commit('RESET_UNIFIED_LOGIN')
            commit('websocket/SET_LOGIN_LOADING', false)

            // 管理员（或 entry=admin 强制）+ HTTP 成功 → 进 admin；其余（操作员 / HTTP 失败）→ 进 client。
            // SSO 入口带 entry=client 时强制进 client（kelai 管理端「企微客服端」入口）
            if ((isAdminType || forceAdmin) && ul.httpOk && state.httpToken && ul.entry !== 'client') {
                commit('SET_ACTIVE_PANEL', 'admin')
                commit('SET_CLIENT_OR_SERVER', 'server')
                router.replace({ name: 'admin' })
            } else {
                // 操作员或 HTTP 失败兜底：固定进聚合聊天
                commit('SET_ACTIVE_PANEL', 'client')
                commit('SET_CLIENT_OR_SERVER', 'client')
                router.replace({ path: '/conversation' }).catch(() => {})
            }
            return
        }

        // WebSocket 失败分支：HTTP 也完成后决策
        if (!ul.httpDone || !ul.wsFailed) return

        commit('websocket/SET_LOGIN_LOADING', false)
        commit('RESET_UNIFIED_LOGIN')

        if (ul.httpOk) {
            // 同 webSocketToken 分支：管理员（或 entry=admin 强制）进 admin；操作员走 client
            // （client 决策由 WS 成功时的 deviceAuthRspHandler 处理，但本分支 WS 已失败，
            //  需要前端主动设 client 并跳转，避免停在 /login）
            const forceAdmin = ul.entry === 'admin'
            if ((isAdminType || forceAdmin) && state.httpToken) {
                commit('SET_ACTIVE_PANEL', 'admin')
                commit('SET_CLIENT_OR_SERVER', 'server')
                router.replace({ name: 'admin' })
            } else {
                // 操作员或 adminInfo 未知：尝试进 client（依赖路由守卫兜底）
                commit('SET_ACTIVE_PANEL', 'client')
                commit('SET_CLIENT_OR_SERVER', 'client')
                router.replace({ path: '/conversation' })
            }
            return
        }

        Message.error('账号或密码错误')
    }
}

/**
 * 全局 mutations
 * <p>
 * 同步修改 state 的方法。
 */
const mutations = {
    /**
     * 设置 WebSocket 连接状态
     * @param {Object} state 状态对象
     * @param {Number} wsState WebSocket 状态码（0-3）
     */
    SET_WEB_SOCKET_STATE(state, wsState) {
        state.webSocketState = wsState
    },

    /**
     * 设置 WebSocket token
     * @param {Object} state 状态对象
     * @param {String} wsToken WebSocket 认证 token
     */
    SET_WEBSOCKET_TOKEN: (state, wsToken) => {
        state.webSocketToken = wsToken
    },

    /**
     * 设置用户信息
     * @param {Object} state 状态对象
     * @param {Object} userInfo 用户信息对象
     */
    SET_USER: (state, userInfo) => {
        state.currentUser = userInfo
    },

    /**
     * 设置运行环境模式
     * @param {Object} state 状态对象
     * @param {String} mode 运行模式：'web' 或 'electron'
     */
    SET_CURRENT_MODE: (state, mode) => {
        state.currentMode = mode
    },

    /**
     * 设置客户端还是管理端
     * @param {Object} state 状态对象
     * @param {String} flagStr 'client' 或 'server'
     */
    SET_CLIENT_OR_SERVER: (state, flagStr) => {
        state.clientOrServer = flagStr
    },

    /**
     * 设置管理员信息
     * @param {Object} state 状态对象
     * @param {Object} adminInfo 管理员信息对象
     */
    SET_ADMIN_INO: (state, adminInfo) => {
        // 后端 AccountInfo.password 已加 @JsonIgnore，正常响应不会带 password；
        // 但旧版后端响应、localStorage 缓存、或残留 token 仍可能含 password 字段，
        // 这里显式剔除避免敏感信息进入 vuex/adminInfo（前端从来不用 password）。
        if (adminInfo && adminInfo !== null && typeof adminInfo === 'object') {
            const safe = { ...adminInfo }
            delete safe.password
            state.adminInfo = safe
            persistAdminInfo(safe)
        } else {
            state.adminInfo = adminInfo || {}
            persistAdminInfo(null)
        }
    },

    /**
     * 设置 HTTP token
     * @param {Object} state 状态对象
     * @param {String} hToken HTTP 认证 token
     */
    SET_HTTP_TOKEN: (state, hToken) => {
        state.httpToken = hToken
        if (typeof localStorage !== 'undefined') {
            if (hToken) {
                localStorage.setItem('httpToken', hToken)
            } else {
                localStorage.removeItem('httpToken')
                // 清空 token 时同步清掉落盘的 adminInfo，避免退出后仍显示旧昵称
                localStorage.removeItem(ADMIN_INFO_KEY)
                state.adminInfo = {}
            }
        }
    },

    /**
     * 设置当前主界面面板（客服端 / 管理端）
     * @param {Object} state 状态对象
     * @param {String} panel 'client' 或 'admin'
     */
    SET_ACTIVE_PANEL: (state, panel) => {
        state.activePanel = panel
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('activePanel', panel)
        }
    },

    BEGIN_UNIFIED_LOGIN(state) {
        state.unifiedLogin = {
            pending: true,
            wsFailed: false,
            httpDone: false,
            httpOk: false,
            entry: ''
        }
    },

    /** 记录 SSO 入口指定的登录后去向（'client' 强制进客服端 / 'admin' 强制进管理端，均优先于账号类型）；须在 BEGIN_UNIFIED_LOGIN 之后 commit */
    SET_UNIFIED_LOGIN_ENTRY(state, entry) {
        state.unifiedLogin.entry = entry === 'client' || entry === 'admin' ? entry : ''
    },

    SET_UNIFIED_LOGIN_HTTP(state, { ok }) {
        state.unifiedLogin.httpDone = true
        state.unifiedLogin.httpOk = ok
    },

    SET_UNIFIED_LOGIN_WS_FAILED(state) {
        state.unifiedLogin.wsFailed = true
    },

    RESET_UNIFIED_LOGIN(state) {
        state.unifiedLogin = defaultUnifiedLogin()
    },

    SET_SHOW_DEV_NICK(state, val) {
        state.showDevNick = Boolean(val)
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('showDevNick', state.showDevNick ? '1' : '0')
        }
    }
}

/**
 * 创建并导出 Vuex Store 实例（Vue3 / Vuex4 使用 createStore）
 * <p>
 * 配置严格模式：开发环境启用，生产环境关闭以提升性能。
 */
const store = createStore({
    modules,      // 模块集合
    state,        // 根状态
    getters,      // 全局 getters
    mutations,    // 全局 mutations
    actions,      // 全局 actions
    strict: process.env.NODE_ENV !== 'production' // 严格模式
})

export default store
