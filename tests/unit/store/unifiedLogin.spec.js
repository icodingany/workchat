/**
 * 统一登录路由决策（tryCompleteUnifiedLogin）单元测试
 * <p>
 * 覆盖 workchat 双 token 模型的核心协调逻辑决策表。
 *
 * <b>关于被测函数：</b>真实实现见 {@code src/store/index.js} 的 {@code tryCompleteUnifiedLogin} action。
 * 因 mochapack（webpack 跑 mocha）会沿 @/store → router → views → scss 拉起整条编译链，
 * 直接 import 真实 store 在当前测试基建下不可行（SCSS prependData、可选链解析均失败）。
 * 故此处将真实 action 的<b>决策逻辑</b>提取为同结构的纯函数 {@link decideUnifiedLogin} 进行测试，
 * 保证决策表被文档化且防回归。<b>若 store/index.js 的实现变更，需同步更新此函数与用例。</b>
 *
 * <b>决策表（source of truth: src/store/index.js）：</b>
 * <ul>
 *   <li>pending=false → 直接返回，不动作（防重入）</li>
 *   <li>webSocketToken 非空（WS 成功）→ 按 adminInfo.type 决策：
 *     <ul>
 *       <li>type=-1/0/1（超管/公司管理员/普通管理员）：
 *         <ul>
 *           <li>HTTP 未完成（httpDone=false）→ 等结果，不动作</li>
 *           <li>HTTP 完成 + 成功 → RESET + 关 loading + SET_ACTIVE_PANEL('admin') + router.replace({name:'admin'})</li>
 *           <li>HTTP 完成 + 成功 + entry=client → RESET + 关 loading + SET_ACTIVE_PANEL('client') + router.replace(/conversation)（SSO 入口强制进客服端）</li>
 *           <li>HTTP 完成 + 失败 → RESET + 关 loading + SET_ACTIVE_PANEL('client') + router.replace(/conversation)</li>
 *         </ul>
 *       </li>
 *       <li>其他 type（操作员或 adminInfo 未知）→ RESET + 关 loading + client + /conversation</li>
 *     </ul>
 *   </li>
 *   <li>httpDone && wsFailed（WS 失败 + HTTP 完成）→ 关 loading + RESET：
 *     <ul>
 *       <li>httpOk → SET_ACTIVE_PANEL('admin') + SET_CLIENT_OR_SERVER('server') + router.replace({name:'admin'})</li>
 *       <li>!httpOk → Message.error('账号或密码错误')</li>
 *     </ul>
 *   </li>
 *   <li>未收齐（!httpDone || !wsFailed）且无 wsToken → 不动作（等结果）</li>
 * </ul>
 */
import { expect } from 'chai'

/**
 * 模拟 router.replace 的记录器。
 * @type {{ called: boolean, args: any[] }}
 */
const router = { called: false, args: [] }
function routerReplace(arg) {
    router.called = true
    router.args.push(arg)
}

/**
 * 模拟 element-ui Message.error 的记录器。
 * @type {{ called: boolean, args: any[] }}
 */
const message = { called: false, args: [] }
function messageError(arg) {
    message.called = true
    message.args.push(arg)
}

/**
 * 复刻 store/index.js 的 tryCompleteUnifiedLogin 决策逻辑（纯函数版本，便于单测）。
 * 返回该次调用产生的副作用清单，便于断言。
 *
 * @param {Object} state 片段状态：{ webSocketToken, httpToken, adminInfo, unifiedLogin }
 * @return {{ commits: Array<{type:string, payload?:any}>, routerReplaced: boolean, messageErrored: boolean }}
 */
function decideUnifiedLogin(state) {
    const ul = state.unifiedLogin
    const commits = []
    let routerReplaced = false
    let messageErrored = false

    if (!ul.pending) {
        return { commits, routerReplaced, messageErrored }
    }

    // 注意：Number(null)===0 会误判为管理员，必须先判 adminInfo 存在
    const ai = state.adminInfo
    const isAdminType = !!ai && [-1, 0, 1].includes(Number(ai.type))

    if (state.webSocketToken) {
        // 管理员账号（或 SSO entry=admin 强制）：必须等 HTTP 也完成才能决策
        const forceAdmin = ul.entry === 'admin'
        if ((isAdminType || forceAdmin) && !ul.httpDone) {
            return { commits, routerReplaced, messageErrored }
        }

        commits.push({ type: 'RESET_UNIFIED_LOGIN' })
        commits.push({ type: 'websocket/SET_LOGIN_LOADING', payload: false })

        // 管理员（或 entry=admin 强制）+ HTTP 成功 → 进 admin；其余（操作员 / HTTP 失败）→ 进 client。
        // SSO 入口带 entry=client 时强制进 client（kelai 管理端「企微客服端」入口）
        if ((isAdminType || forceAdmin) && ul.httpOk && state.httpToken && ul.entry !== 'client') {
            commits.push({ type: 'SET_ACTIVE_PANEL', payload: 'admin' })
            commits.push({ type: 'SET_CLIENT_OR_SERVER', payload: 'server' })
            routerReplace({ name: 'admin' })
            routerReplaced = true
        } else {
            // 操作员或 HTTP 失败兜底：固定进聚合聊天
            commits.push({ type: 'SET_ACTIVE_PANEL', payload: 'client' })
            commits.push({ type: 'SET_CLIENT_OR_SERVER', payload: 'client' })
            routerReplace({ path: '/conversation' })
            routerReplaced = true
        }
        return { commits, routerReplaced, messageErrored }
    }

    if (!ul.httpDone || !ul.wsFailed) {
        return { commits, routerReplaced, messageErrored }
    }

    commits.push({ type: 'websocket/SET_LOGIN_LOADING', payload: false })
    commits.push({ type: 'RESET_UNIFIED_LOGIN' })

    const forceAdmin = ul.entry === 'admin'
    if (ul.httpOk) {
        if ((isAdminType || forceAdmin) && state.httpToken) {
            commits.push({ type: 'SET_ACTIVE_PANEL', payload: 'admin' })
            commits.push({ type: 'SET_CLIENT_OR_SERVER', payload: 'server' })
            routerReplace({ name: 'admin' })
            routerReplaced = true
        } else {
            commits.push({ type: 'SET_ACTIVE_PANEL', payload: 'client' })
            commits.push({ type: 'SET_CLIENT_OR_SERVER', payload: 'client' })
            routerReplace({ path: '/conversation' })
            routerReplaced = true
        }
        return { commits, routerReplaced, messageErrored }
    }

    messageError('账号或密码错误')
    messageErrored = true
    return { commits, routerReplaced, messageErrored }
}

/**
 * 构造状态对象的辅助函数。
 * @param {Object} [overrides]        覆盖 unifiedLogin 字段
 * @param {Object} [options.adminInfo] adminInfo 对象（默认无 = 操作员/未知）
 * @param {Object} [options.httpToken] httpToken（默认空字符串）
 */
function makeState(overrides = {}, options = {}) {
    return {
        webSocketToken: '',
        httpToken: options.httpToken || '',
        adminInfo: options.adminInfo || null,
        unifiedLogin: {
            pending: true,
            wsFailed: false,
            httpDone: false,
            httpOk: false,
            ...overrides
        }
    }
}

describe('store: tryCompleteUnifiedLogin（统一登录路由决策表）', () => {
    beforeEach(() => {
        router.called = false
        router.args = []
        message.called = false
        message.args = []
    })

    it('WS 成功（webSocketToken 非空）+ 操作员 → RESET + 关 loading + 进聚合聊天', () => {
        const state = makeState()
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        expect(messageErrored).to.equal(false)
        const types = commits.map((c) => c.type)
        expect(types).to.include('RESET_UNIFIED_LOGIN')
        expect(types).to.include('websocket/SET_LOGIN_LOADING')
        expect(types).to.include('SET_ACTIVE_PANEL')
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
    })

    it('WS 失败 + HTTP 成功 + 操作员（无 adminInfo）→ 进 client，跳 /conversation', () => {
        const state = makeState({ wsFailed: true, httpDone: true, httpOk: true })

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        expect(messageErrored).to.equal(false)
        const types = commits.map((c) => c.type)
        expect(types).to.include('SET_ACTIVE_PANEL')
        expect(types).to.include('SET_CLIENT_OR_SERVER')
        expect(types).to.include('RESET_UNIFIED_LOGIN')
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
    })

    it('WS 失败 + HTTP 成功 + 管理员(type=0) → 跳 /admin', () => {
        const state = makeState(
            { wsFailed: true, httpDone: true, httpOk: true },
            { adminInfo: { type: 0 }, httpToken: 'http-token-xxx' }
        )

        const { commits, routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('admin')
    })

    it('WS 失败 + HTTP 失败 → Message.error 提示账号密码错误', () => {
        const state = makeState({ wsFailed: true, httpDone: true, httpOk: false })

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(messageErrored).to.equal(true)
        expect(message.args[0]).to.equal('账号或密码错误')
        expect(routerReplaced).to.equal(false)
        const types = commits.map((c) => c.type)
        expect(types).to.include('RESET_UNIFIED_LOGIN')
    })

    it('WS 失败但 HTTP 未完成（httpDone=false）→ 不动作，等结果', () => {
        const state = makeState({ wsFailed: true, httpDone: false, httpOk: false })

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(false)
        expect(messageErrored).to.equal(false)
        expect(commits.map((c) => c.type)).to.not.include('RESET_UNIFIED_LOGIN')
    })

    it('pending=false → 直接返回，无任何动作（防重入）', () => {
        const state = makeState()
        state.unifiedLogin.pending = false

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(false)
        expect(messageErrored).to.equal(false)
        expect(commits.length).to.equal(0)
    })

    it('WS token 优先级：操作员（无 adminInfo）双端成功仍走客服端聚合聊天', () => {
        const state = makeState({ wsFailed: false, httpDone: true, httpOk: true })
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        expect(messageErrored).to.equal(false)
        expect(commits.map((c) => c.type)).to.include('RESET_UNIFIED_LOGIN')
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
    })

    // ============ 管理员（type=0/-1）决策分支 ============

    it('管理员(type=0) WS+HTTP 双成功 → 跳 /admin', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true },
            { adminInfo: { type: 0 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
        expect(messageErrored).to.equal(false)
        const types = commits.map((c) => c.type)
        expect(types).to.include('SET_ACTIVE_PANEL')
        expect(types).to.include('SET_CLIENT_OR_SERVER')
        expect(types).to.include('RESET_UNIFIED_LOGIN')
        // SET_ACTIVE_PANEL 的 payload 应是 admin
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('admin')
    })

    it('超管(type=-1) WS+HTTP 双成功 → 跳 /admin', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true },
            { adminInfo: { type: -1 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
    })

    // ============ SSO entry 去向覆盖（kelai「企微客服端」入口） ============

    it('管理员(type=0) WS+HTTP 双成功 + entry=client → 强制进聚合聊天', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true, entry: 'client' },
            { adminInfo: { type: 0 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
    })

    it('entry 只认 client：entry=admin/其它值不影响默认决策（管理员仍进 /admin）', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true, entry: 'admin' },
            { adminInfo: { type: 0 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
    })

    it('管理员 WS 成功但 HTTP 未完成 → 等结果，不动作（避免时序错位）', () => {
        const state = makeState(
            { wsFailed: false, httpDone: false, httpOk: false },
            { adminInfo: { type: 0 } }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(false)
        expect(messageErrored).to.equal(false)
        // 关键：不应 RESET，要保留 pending 等下一次 dispatch
        expect(commits.map((c) => c.type)).to.not.include('RESET_UNIFIED_LOGIN')
    })

    it('管理员 WS+HTTP 双成功但无 httpToken → 兜底进聚合聊天（不进 admin）', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true },
            { adminInfo: { type: 0 }, httpToken: '' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
    })

    it('管理员 WS 成功 + HTTP 失败 → 兜底进聚合聊天', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: false },
            { adminInfo: { type: 0 } }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced, messageErrored } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        expect(messageErrored).to.equal(false)
        expect(commits.map((c) => c.type)).to.include('RESET_UNIFIED_LOGIN')
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
    })

    it('普通管理员(type=1) WS+HTTP 双成功 → 进 admin（对齐 store isAdminType 含 1）', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true },
            { adminInfo: { type: 1 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('admin')
        expect(commits.map((c) => c.type)).to.include('RESET_UNIFIED_LOGIN')
    })

    it('普通员工(type=2) WS+HTTP 双成功 → 进聚合聊天', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true },
            { adminInfo: { type: 2 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('client')
        expect(commits.map((c) => c.type)).to.include('RESET_UNIFIED_LOGIN')
    })

    it('entry=admin + 操作员(type=1) WS+HTTP 双成功 → 强制进 admin（客徕徕企微管理菜单深链）', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true, entry: 'admin' },
            { adminInfo: { type: 1 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { commits, routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
        const panelCommit = commits.find((c) => c.type === 'SET_ACTIVE_PANEL')
        expect(panelCommit.payload).to.equal('admin')
    })

    it('entry=admin + 无 adminInfo（未知类型）+ WS+HTTP 双成功 → 强制进 admin', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true, entry: 'admin' },
            { httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
    })

    it('entry=admin + HTTP 未完成 → 等结果不动作', () => {
        const state = makeState(
            { wsFailed: false, httpDone: false, httpOk: false, entry: 'admin' },
            { adminInfo: { type: 1 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { routerReplaced, commits } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(false)
        expect(commits).to.have.lengthOf(0)
    })

    it('entry=admin + WS 失败 + HTTP 成功 → 强制进 admin', () => {
        const state = makeState(
            { wsFailed: true, httpDone: true, httpOk: true, entry: 'admin' },
            { adminInfo: { type: 1 }, httpToken: 'http-token-xxx' }
        )

        const { routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ name: 'admin' })
    })

    it('entry=client 仍优先于 entry 语义冲突（后写覆盖）→ 强制进 client 不受影响', () => {
        const state = makeState(
            { wsFailed: false, httpDone: true, httpOk: true, entry: 'client' },
            { adminInfo: { type: 0 }, httpToken: 'http-token-xxx' }
        )
        state.webSocketToken = 'ws-token-xxx'

        const { routerReplaced } = decideUnifiedLogin(state)

        expect(routerReplaced).to.equal(true)
        expect(router.args[0]).to.deep.equal({ path: '/conversation' })
    })
})
