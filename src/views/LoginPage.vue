<template>
  <div class="login-page">
    <div v-if="isDesktop" style="-webkit-app-region: drag" class="electron-menu">
      <i
        style="-webkit-app-region: no-drag"
        class="fa fa-times fa-lg"
        aria-hidden="true"
        @click="closeElectron"
      ></i>
    </div>

    <div class="login-container">
      <div class="login-page-form">
        <!-- logo 放置对齐 kelailaichatpc：表单上方居中，无额外品牌标题 -->
        <img class="login-logo" src="../assets/images/logo.png" alt="客徕徕" />

        <el-form :model="loginForm" :rules="rules" status-icon ref="ruleForm" size="default">
          <el-form-item prop="name">
            <el-input
              v-model="loginForm.name"
              maxlength="20"
              placeholder="请输入账号"
              prefix-icon="el-icon-user-solid"
              autocomplete="username"
              :input-style="loginInputStyle"
              @input="changeName()"
            ></el-input>
          </el-form-item>
          <el-form-item prop="pass">
            <el-input
              type="password"
              v-model="loginForm.pass"
              autocomplete="current-password"
              show-password
              placeholder="请输入密码"
              :maxlength="20"
              prefix-icon="el-icon-unlock"
              :input-style="loginInputStyle"
              @keyup.enter="submitForm('ruleForm')"
            ></el-input>
          </el-form-item>
        </el-form>

        <div class="login-options">
          <el-checkbox v-model="rememberPwd">记住密码</el-checkbox>
        </div>

        <div class="login_btn_box">
          <el-button
            type="primary"
            :loading="loading"
            :disabled="loading"
            class="login-btn"
            @click="submitForm('ruleForm')"
          >
            登 录
          </el-button>
        </div>
        <div v-if="wsErrorText" class="ws-error-text">
          <span>{{ wsErrorText }}</span>
        </div>
        <span class="login-logo-version">v-{{ version }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { debounce } from 'lodash'
import { deviceAuthReq } from '../api/webSocketApi'
import { createWebSocket, retryWebSocketConnection } from '../websocket/websocket'
import pkgVersion from '../../package.json'
import { ssoLogin } from '../api/httpApiAdmin' // SSO 兑换本端登录态
import { masterLogin, masterApiBaseUrl } from '../api/masterAuthApi' // 个微端密码校验（003 账号融合）
import { markSsoEmbedded, clearSsoEmbedded } from '../utils/ssoEmbedded'

export default {
  name: 'LoginPage',
  data() {
    let checkName = (rule, value, callback) => {
      if (!value) {
        return callback(new Error('用户名不能为空'))
      } else {
        callback()
      }
    }
    let validatePass = (rule, value, callback) => {
      if (value === '') {
        callback(new Error('请输入密码'))
      } else {
        callback()
      }
    }
    return {
      rememberPwd: false,
      version: pkgVersion.version,
      loginForm: {
        name: '',
        pass: ''
      },
      rules: {
        name: [{ validator: checkName, trigger: 'blur' }],
        pass: [{ validator: validatePass, trigger: 'blur' }]
      },
      // 内联锁白字，防止 focus/autofill 被浏览器打成黑色（对齐 kelailaichatpc）
      loginInputStyle: {
        color: '#ffffff',
        WebkitTextFillColor: '#ffffff',
        caretColor: '#ffffff'
      },
      wsErrorText: ''
    }
  },
  computed: {
    ...mapState({
      currentMode: 'currentMode', // 是pc还是web
      webSocketState: 'webSocketState' // websocket连接状态
    }),
    ...mapGetters({
      loading: 'websocket/loginLoading',
      isDesktop: 'isDesktop'
    }),
    localName() {
      if (localStorage.getItem('localNameOfJuboChat')) {
        return localStorage.getItem('localNameOfJuboChat')
      }
      return ''
    },
    localPwd() {
      if (localStorage.getItem('localPwdOfJuboChat')) {
        return localStorage.getItem('localPwdOfJuboChat')
      }
      return ''
    }
  },
  methods: {
    // 如果改变用户名 清空密码
    changeName() {
      this.loginForm.pass = ''
    },
    /**
     * 等待 store 字段满足条件（对齐 kelailaichatpc：WS 重连中自动等待，不弹「请稍后再试」）
     */
    waitForStoreValue(getter, predicate, { timeoutMs = 15000, label = '等待中' } = {}) {
      return new Promise((resolve, reject) => {
        let done = false
        const unwatch = this.$store.watch(
          getter,
          (val) => {
            if (done) return
            try {
              if (predicate(val)) {
                done = true
                cleanup()
                resolve(val)
              }
            } catch (e) {
              /* ignore */
            }
          },
          { immediate: true }
        )
        const timer = setTimeout(() => {
          if (done) return
          done = true
          cleanup()
          reject(new Error(`${label}超时`))
        }, timeoutMs)
        const cleanup = () => {
          try {
            clearTimeout(timer)
          } catch (e) {
            /* ignore */
          }
          try {
            if (typeof unwatch === 'function') unwatch()
          } catch (e) {
            /* ignore */
          }
        }
      })
    },
    /**
     * 主动建连并等待 OPEN（对齐 kelailaichatpc：断网恢复后点登录自动等待，不立刻弹窗）
     */
    async ensureWebSocketConnected(timeoutMs = 20000) {
      if (this.webSocketState === 1) return
      const wsUrl = process.env.VUE_APP_WEBSOCKET_URL
      if (!wsUrl) {
        throw new Error('未配置 WebSocket 地址')
      }
      if (this.webSocketState === 3) {
        retryWebSocketConnection(wsUrl)
      } else if (this.webSocketState !== 0) {
        createWebSocket(wsUrl)
      }
      await this.waitForStoreValue(
        () => this.webSocketState,
        (v) => v === 1,
        { timeoutMs, label: 'WebSocket连接' }
      )
    },
    /**
     * 两步登录（003 账号融合）：
     * ① 个微端（客徕徕 wei-kefu-be）/user/login 校验账号密码 → 个微 access token；
     * ② 本端 /user/sso/login 兑换企聊登录态。密码不再在本端校验，
     *    身份/角色/cid 均以本端锚点（身份同步）为准。
     * WS 凭证：密码位传本端 HTTP token（后端 WsJwtCredentialService 识别验签），
     * 对齐 SSO 路径——真实密码不再进 sessionStorage。
     */
    async doUnifiedLogin(submitName, submitPass) {
      this.$store.commit('SET_USER', {
        ...(this.$store.state.currentUser || {}),
        account: submitName
      })
      try {
        sessionStorage.setItem('sessionNameOfJuboChat', submitName)
      } catch (e) {
        /* ignore quota / private mode */
      }
      if (!masterApiBaseUrl()) {
        this.finishLoginFailure('未配置个微登录地址，请联系管理员')
        return
      }
      // ① 个微端密码校验
      let masterRes
      try {
        masterRes = await masterLogin(submitName, submitPass)
      } catch (e) {
        masterRes = { code: -1, msg: '登录服务不可用，请稍后重试' }
      }
      if (masterRes.code !== 0 || !masterRes.data || !masterRes.data.token) {
        this.finishLoginFailure('账号或密码错误')
        return
      }
      // ② 本端兑换登录态（失败原样提示，如「该客徕徕账号未开通企聊客服」）
      let res
      try {
        res = await ssoLogin(masterRes.data.token)
      } catch (e) {
        res = { code: -1, msg: '登录服务不可用，请稍后重试' }
      }
      const ok = res.code === 0 && res.data && res.data.token
      if (!ok) {
        this.finishLoginFailure(res.msg || '账号或密码错误')
        return
      }
      // 账号密码登录 = 独立访问，清除内嵌态标记
      clearSsoEmbedded()
      const localToken = res.data.token
      try {
        sessionStorage.setItem('sessionPwdOfJuboChat', localToken)
      } catch (e) {
        /* ignore quota / private mode */
      }
      deviceAuthReq(submitName, localToken)
      this.$store.commit('SET_ADMIN_INO', res.data)
      this.$store.commit('SET_HTTP_TOKEN', localToken)
      localStorage.setItem('httpToken', localToken)
      this.$store.commit('SET_UNIFIED_LOGIN_HTTP', { ok: true })
      this.$store.dispatch('tryCompleteUnifiedLogin')
    },
    /** 登录失败收尾：留在登录页，红字提示，等下次输入 */
    finishLoginFailure(msg) {
      this.wsErrorText = msg
      this.$store.commit('RESET_UNIFIED_LOGIN')
      this.$store.commit('websocket/SET_LOGIN_LOADING', false)
    },
    // 登陆
    async submitForm(formName) {
      let valid = false
      try {
        valid = await new Promise((resolve) => {
          this.$refs[formName].validate((isValid) => resolve(isValid))
        })
      } catch (e) {
        return false
      }
      if (!valid) return false

      if (this.rememberPwd) {
        localStorage.setItem('localNameOfJuboChat', this.loginForm.name)
        localStorage.setItem('localPwdOfJuboChat', this.loginForm.pass)
      }

      const submitName = this.loginForm.name
      const submitPass = this.loginForm.pass
      this.wsErrorText = ''
      this.$store.commit('BEGIN_UNIFIED_LOGIN')
      this.$store.commit('websocket/SET_LOGIN_LOADING', true)

      try {
        await this.ensureWebSocketConnected()
        await this.doUnifiedLogin(submitName, submitPass)
      } catch (e) {
        this.wsErrorText =
          this.webSocketState === 0
            ? '连接超时，请检查网络后点击登录重试'
            : 'WebSocket 连接失败，请检查网络后点击登录重试'
        this.$store.commit('RESET_UNIFIED_LOGIN')
        this.$store.commit('websocket/SET_LOGIN_LOADING', false)
      }
    },
    /**
     * SSO 兑换登录（客徕徕内嵌企微 tab 用）：
     * URL hash 带 sso_token（kelai 端的 HTTP access token）→ 先调 /user/sso/login
     * 换取本端登录态 → WS 设备认证用「JWT 当密码」免密通道（本端 token 作凭证）。
     */
    async doSsoLogin(ssoToken) {
      let res
      try {
        res = await ssoLogin(ssoToken)
      } catch (e) {
        throw new Error('SSO 登录请求失败，请手动登录')
      }
      const ok = res && res.code === 0 && res.data && res.data.token
      if (!ok) {
        throw new Error((res && res.msg) || 'SSO 登录失败，请手动登录')
      }
      const account = res.data.account
      // WS 凭证：密码位传本端 HTTP token，后端 WsJwtCredentialService 识别验签
      const wsCredential = res.data.token
      this.$store.commit('SET_USER', {
        ...(this.$store.state.currentUser || {}),
        account: account
      })
      try {
        sessionStorage.setItem('sessionNameOfJuboChat', account)
        sessionStorage.setItem('sessionPwdOfJuboChat', wsCredential)
      } catch (e) {
        /* ignore quota / private mode */
      }
      deviceAuthReq(account, wsCredential)
      this.$store.commit('SET_ADMIN_INO', res.data)
      this.$store.commit('SET_HTTP_TOKEN', res.data.token)
      localStorage.setItem('httpToken', res.data.token)
      // 标记内嵌态：顶栏隐藏头像昵称下拉（身份/密码由客徕徕宿主管）
      markSsoEmbedded()
      this.$store.commit('SET_UNIFIED_LOGIN_HTTP', { ok: true })
      this.$store.dispatch('tryCompleteUnifiedLogin')
    },
    /**
     * 从路由 query 中取出 sso_token（及可选的 entry 去向）并立即清掉（本应用是
     * hash 路由，query 仍在 hash 内、不进服务端日志；kelai 端以
     * `#/login?sso_token=...&entry=client` 形态带入）。
     * @returns {{token: string, entry: string}} token 为空表示无 SSO 参数
     */
    extractSsoTokenFromRoute() {
      try {
        const token = this.$route.query && this.$route.query.sso_token
        if (!token) return { token: '', entry: '' }
        const entryParam = this.$route.query.entry
        const entry = entryParam === 'client' ? 'client' : entryParam === 'admin' ? 'admin' : ''
        // 客徕徕内嵌管理页深链：nav 随 SSO 带入，暂存给 admin 页落地后定位（resolveNavFromQuery）
        const nav = this.$route.query.nav
        if (nav) sessionStorage.setItem('wecomAdminNav', String(nav))
        const query = { ...this.$route.query }
        delete query.sso_token
        delete query.entry
        delete query.nav
        this.$router.replace({ query }).catch(() => {})
        return { token: String(token), entry }
      } catch (e) {
        return { token: '', entry: '' }
      }
    },
    /** 页面加载即尝试 SSO（kelai iframe/跳转带 token 进入）；失败回落手动登录 */
    async trySsoFromUrl() {
      const { token: ssoToken, entry } = this.extractSsoTokenFromRoute()
      if (!ssoToken) return
      this.wsErrorText = ''
      this.$store.commit('BEGIN_UNIFIED_LOGIN')
      // kelai 入口指定去向（entry=client 强制进客服端）；须在 BEGIN 之后设置，避免被重置
      this.$store.commit('SET_UNIFIED_LOGIN_ENTRY', entry)
      this.$store.commit('websocket/SET_LOGIN_LOADING', true)
      try {
        await this.ensureWebSocketConnected()
        await this.doSsoLogin(ssoToken)
      } catch (e) {
        this.wsErrorText = (e && e.message) || 'SSO 登录失败，请手动登录'
        this.$store.commit('RESET_UNIFIED_LOGIN')
        this.$store.commit('websocket/SET_LOGIN_LOADING', false)
      }
    },
    // 重置表单
    resetForm(formName) {
      this.$refs[formName].resetFields()
    },
    // 退出electron
    closeElectron() {
      this.$ipcRenderer.send('operations', 'exit')
    }
  },
  watch: {
    rememberPwd(val) {
      if (val) {
        localStorage.setItem('remarkPwdOfJuboChat', 1)
      } else {
        localStorage.removeItem('remarkPwdOfJuboChat')
        localStorage.removeItem('localNameOfJuboChat')
        localStorage.removeItem('localPwdOfJuboChat')
      }
    }
  },
  created() {
    // 记住密码
    if (localStorage.getItem('remarkPwdOfJuboChat')) {
      this.rememberPwd = true
      if (this.localName && this.localPwd) {
        this.loginForm.name = this.localName
        this.loginForm.pass = this.localPwd
      }
    }
    // 防抖
    this.changeName = debounce(this.changeName, 300)
    // 客徕徕 SSO：路由 query 带 sso_token 时自动兑换登录
    this.trySsoFromUrl()
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  background: #0a0e1a;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0, 174, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 174, 255, 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: gridMove 20s linear infinite;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent 2px
    );
    pointer-events: none;
    opacity: 0.5;
  }
}

@keyframes gridMove {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(50px, 50px);
  }
}

.login-container {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 24px;
}

.login-page-form {
  box-sizing: border-box;
  width: 480px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(5, 10, 20, 0.95) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 24px;
  box-shadow:
    0 0 0 1px rgba(0, 174, 255, 0.2),
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 80px rgba(0, 174, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  padding: 48px 40px 36px;
  backdrop-filter: blur(40px);
  position: relative;
  animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(0, 174, 255, 0.8), transparent);
    border-radius: 2px;
  }

  .login-logo {
    width: 200px;
    height: 60px;
    margin-top: 50px;
    object-fit: contain;
    object-position: center;
    /* logo.png 已是深色页白字透明底，勿再 invert（白底图会被滤成整块白） */
    animation: logoFloat 3s ease-in-out infinite;
  }

  @keyframes logoFloat {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  :deep(.el-form) {
    width: 320px;
    margin-top: 40px;

    .el-form-item {
      margin-bottom: 20px;
    }

    .el-input {
      --el-input-bg-color: transparent;
      --el-input-text-color: #ffffff;
      --el-input-border-color: rgba(255, 255, 255, 0.15);
      --el-input-hover-border-color: rgba(0, 174, 255, 0.5);
      --el-input-focus-border-color: #00aeff;
      --el-input-placeholder-color: rgba(255, 255, 255, 0.4);
      height: 48px;
      width: 100%;
    }

    // Element Plus 视觉框在 wrapper，不要给 inner 打深色 inset（会白框套黑框）
    .el-input__wrapper {
      background: rgba(255, 255, 255, 0.08) !important;
      border-radius: 12px !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset !important;
      padding: 1px 15px;
      transition:
        box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        background 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0 0 0 1px rgba(0, 174, 255, 0.5) inset !important;
      }

      &.is-focus {
        background: rgba(255, 255, 255, 0.12) !important;
        box-shadow:
          0 0 0 1px #00aeff inset,
          0 0 0 3px rgba(0, 174, 255, 0.1) !important;
      }

      &:has(.el-input__inner:-webkit-autofill) {
        background: #0f172a !important;
      }
    }

    .el-input__inner {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      color-scheme: dark;
      height: 46px;
      font-size: 15px;

      &::placeholder {
        color: rgba(255, 255, 255, 0.4);
        -webkit-text-fill-color: rgba(255, 255, 255, 0.4);
      }

      &:hover,
      &:focus,
      &:active {
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
        caret-color: #ffffff !important;
      }

      // 自动填充：字白；用无圆角 inset 盖白底，避免「白框套黑圆角框」
      &:-webkit-autofill,
      &:-webkit-autofill:hover,
      &:-webkit-autofill:focus,
      &:-webkit-autofill:active {
        -webkit-text-fill-color: #ffffff !important;
        color: #ffffff !important;
        caret-color: #ffffff !important;
        border: none !important;
        border-radius: 0 !important;
        -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
        box-shadow: 0 0 0 1000px #0f172a inset !important;
        transition: background-color 99999s ease-in-out 0s;
      }
    }

    .el-input__prefix,
    .el-input__suffix {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .login-options {
    width: 320px;
    margin-bottom: 8px;

    :deep(.el-checkbox__label) {
      color: rgba(255, 255, 255, 0.7);
    }

    :deep(.el-checkbox__inner) {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }

    :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
      background: #00aeff;
      border-color: #00aeff;
    }
  }

  .ws-error-text {
    margin-top: 12px;
    width: 320px;
    font-size: 12px;
    color: rgba(255, 180, 180, 0.9);
    text-align: center;
    line-height: 1.5;
  }

  .login_btn_box {
    margin-top: 20px;

    .login-btn {
      width: 320px;
      height: 50px;
      border-radius: 12px;
      background: linear-gradient(135deg, #00aeff 0%, #0066cc 100%);
      border: none;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      box-shadow: 0 8px 24px rgba(0, 174, 255, 0.3);
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(0, 174, 255, 0.4);
        background: linear-gradient(135deg, #33beff 0%, #1a75d1 100%);
      }
    }
  }

  .login-logo-version {
    margin-top: 20px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.electron-menu {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  height: 36px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  i {
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    &:hover {
      color: #00aeff;
    }
  }
}

@media only screen and (max-width: 560px) {
  .login-page-form {
    width: 92vw;
    padding: 36px 20px 28px;

    :deep(.el-form),
    .login-options,
    .login_btn_box .login-btn {
      width: 100%;
    }
  }
}
</style>

<!-- 非 scoped：Element Plus + Chrome autofill/focus 字色（对齐 kelailaichatpc 6a11572d） -->
<style lang="scss">
.login-page {
  color-scheme: dark;
}

.login-page .el-input {
  --el-input-text-color: #ffffff;
  --el-text-color-regular: #ffffff;
  --el-input-bg-color: transparent;
  color-scheme: dark;
}

.login-page .el-input__wrapper {
  background: rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset !important;
}

.login-page .el-input__wrapper.is-focus {
  background: rgba(255, 255, 255, 0.12) !important;
  box-shadow:
    0 0 0 1px #00aeff inset,
    0 0 0 3px rgba(0, 174, 255, 0.1) !important;
}

.login-page .el-input__wrapper:has(.el-input__inner:-webkit-autofill) {
  background: #0f172a !important;
}

.login-page .el-input__inner,
.login-page .el-input__inner:hover,
.login-page .el-input__inner:focus,
.login-page .el-input__inner:active,
.login-page .el-input.is-focus .el-input__inner,
.login-page .el-input__wrapper.is-focus .el-input__inner {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #ffffff !important;
  background-color: transparent !important;
  box-shadow: none !important;
  color-scheme: dark;
}

.login-page .el-input__inner:-webkit-autofill,
.login-page .el-input__inner:-webkit-autofill:hover,
.login-page .el-input__inner:-webkit-autofill:focus,
.login-page .el-input__inner:-webkit-autofill:active {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #ffffff !important;
  border-radius: 0 !important;
  -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
  box-shadow: 0 0 0 1000px #0f172a inset !important;
  transition: background-color 99999s ease-in-out 0s;
}

.login-page .el-input__inner::selection {
  background: rgba(0, 174, 255, 0.45);
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
}
</style>
