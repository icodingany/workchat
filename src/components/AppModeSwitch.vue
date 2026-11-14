<template>
  <!-- 平台超管（type=-1）仅管理端，不展示客服端/管理端切换 -->
  <div v-if="!superAdmin" class="app-mode-switch" :class="`theme-${theme}`">
    <span
      class="mode-tab"
      :class="{ active: activePanel === 'client', disabled: switching }"
      @click="switchTo('client')"
    >
      客服端
    </span>
    <span
      class="mode-tab"
      :class="{ active: activePanel === 'admin', disabled: switching }"
      :title="!httpToken ? '管理端登录已过期，点击将重新验证' : ''"
      @click="switchTo('admin')"
    >
      管理端
    </span>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { deviceAuthReq } from '@/api/webSocketApi'
import { login } from '@/api/httpApiAdmin'
import { createWebSocket } from '@/websocket/websocket'

/** 从 JWT payload 读账号（sub），刷新后 adminInfo 丢失时仍可用 */
function accountFromHttpToken(token) {
  if (!token || typeof token !== 'string') return ''
  try {
    const part = token.split('.')[1]
    if (!part) return ''
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(decodeURIComponent(escape(atob(b64))))
    return (json && (json.sub || json.account)) || ''
  } catch (e) {
    return ''
  }
}

export default {
  name: 'AppModeSwitch',
  props: {
    theme: {
      type: String,
      default: 'dark'
    }
  },
  data() {
    return {
      switching: false
    }
  },
  computed: {
    ...mapState({
      activePanel: 'activePanel',
      httpToken: 'httpToken',
      webSocketToken: 'webSocketToken',
      webSocketState: 'webSocketState',
      adminInfo: 'adminInfo'
    }),
    ...mapGetters(['superAdmin'])
  },
  methods: {
    /** 账号：session / 记住密码 / adminInfo / JWT.sub */
    resolveAccountName() {
      return (
        sessionStorage.getItem('sessionNameOfJuboChat') ||
        localStorage.getItem('localNameOfJuboChat') ||
        (this.adminInfo && this.adminInfo.account) ||
        accountFromHttpToken(this.httpToken) ||
        ''
      )
    },
    resolvePassword() {
      return (
        sessionStorage.getItem('sessionPwdOfJuboChat') ||
        localStorage.getItem('localPwdOfJuboChat') ||
        ''
      )
    },
    saveSessionCredentials(name, pass) {
      try {
        if (name) sessionStorage.setItem('sessionNameOfJuboChat', name)
        if (pass) sessionStorage.setItem('sessionPwdOfJuboChat', pass)
      } catch (e) {
        /* ignore */
      }
    },
    /**
     * 无密码时弹窗补输（刷新后常见：httpToken 还在，密码不在）
     * @returns {Promise<{name: string, pass: string}>}
     */
    async resolveCredentials() {
      let name = this.resolveAccountName()
      let pass = this.resolvePassword()
      if (name && pass) return { name, pass }

      if (!name) {
        try {
          const { value } = await this.$prompt('请输入登录账号', '进入客服端', {
            confirmButtonText: '下一步',
            cancelButtonText: '取消',
            inputPlaceholder: '账号',
            inputValue: '',
            inputValidator: (v) => !!(v && String(v).trim()) || '请输入账号'
          })
          name = String(value).trim()
        } catch (e) {
          throw new Error('cancelled')
        }
      }

      try {
        const { value } = await this.$prompt(`请输入账号「${name}」的密码`, '进入客服端', {
          confirmButtonText: '登录',
          cancelButtonText: '取消',
          inputType: 'password',
          inputPlaceholder: '密码',
          inputValidator: (v) => !!(v && String(v).trim()) || '请输入密码'
        })
        pass = String(value)
      } catch (e) {
        throw new Error('cancelled')
      }

      this.saveSessionCredentials(name, pass)
      return { name, pass }
    },
  waitForStoreValue(getter, predicate, timeoutMs, label) {
      return new Promise((resolve, reject) => {
        let done = false
        const finish = (callback) => {
          if (done) return
          done = true
          clearTimeout(timer)
          unwatch()
          callback()
        }
        const unwatch = this.$store.watch(
          getter,
          (value) => {
            if (predicate(value)) finish(() => resolve(value))
          },
          { immediate: true }
        )
        const timer = setTimeout(() => finish(() => reject(new Error(label))), timeoutMs)
      })
    },
    /** WS 未打开时先建连/等重连完成（对齐移动端 MobileAdmin.ensureClientWsLogin） */
    async ensureWebSocketOpen() {
      if (this.webSocketState === 1) return
      createWebSocket(process.env.VUE_APP_WEBSOCKET_URL)
      await this.waitForStoreValue(
        () => this.$store.state.webSocketState,
        (state) => state === 1,
        12000,
        'WebSocket 连接超时'
      )
    },
    /**
     * 无 WS token 时补发 DeviceAuthReq，等 DeviceAuthRsp 落 token
     * @returns {Promise<void>}
     */
    async ensureClientWsLogin() {
      await this.ensureWebSocketOpen()
      if (this.webSocketToken) return

      const { name, pass } = await this.resolveCredentials()

      try {
        sessionStorage.setItem('wsAuthInProgress', '1')
      } catch (e) {
        /* ignore */
      }

      return new Promise((resolve, reject) => {
        const loading = this.$loading({
          lock: true,
          text: '正在登录客服端...',
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.35)'
        })
        let settled = false
        const finish = (fn) => {
          if (settled) return
          settled = true
          unwatchToken()
          unwatchLoading()
          clearTimeout(timer)
          loading.close()
          try {
            sessionStorage.removeItem('wsAuthInProgress')
          } catch (e) {
            /* ignore */
          }
          fn()
        }

        const unwatchToken = this.$store.watch(
          (s) => s.webSocketToken,
          (token) => {
            if (token && String(token).trim()) finish(() => resolve())
          },
          { immediate: true }
        )
        this.$store.commit('websocket/SET_LOGIN_LOADING', true)
        const unwatchLoading = this.$store.watch(
          (s) => s.websocket.loginLoading,
          (loading) => {
            if (!loading && !this.$store.state.webSocketToken) {
              finish(() => reject(new Error('auth failed')))
            }
          }
        )
        const timer = setTimeout(() => {
          finish(() => {
            this.$message.error('客服端登录超时，请重试')
            reject(new Error('timeout'))
          })
        }, 12000)

        const sent = deviceAuthReq(name, pass)
        if (!sent) {
          this.$store.commit('websocket/SET_LOGIN_LOADING', false)
          finish(() => reject(new Error('WebSocket 未连接，请稍后重试')))
        }
      })
    },
    /**
     * 无 httpToken 时补登管理端（JWT 过期后 WS 仍可用，对齐 ensureClientWsLogin）。
     * @returns {Promise<void>}
     */
    async ensureAdminHttpLogin() {
      if (this.httpToken) return

      const { name, pass } = await this.resolveCredentials()
      const loading = this.$loading({
        lock: true,
        text: '正在登录管理端...',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.35)'
      })
      try {
        const res = await login(name, pass)
        if (!res || res.code !== 0 || !res.data || !res.data.token) {
          throw new Error((res && res.msg) || '管理端登录失败')
        }
        const t = Number(res.data.type)
        if (t !== -1 && t !== 0 && t !== 1) {
          throw new Error('当前账号无管理端权限')
        }
        this.$store.commit('SET_ADMIN_INO', res.data)
        this.$store.commit('SET_HTTP_TOKEN', res.data.token)
        localStorage.setItem('httpToken', res.data.token)
      } finally {
        loading.close()
      }
    },
    async switchTo(panel) {
      if (this.switching) return
      // 平台超管禁止进入客服端（切换器已隐藏，此处兜底）
      if (this.superAdmin && panel === 'client') return
      if (panel === 'admin' && !this.httpToken) {
        this.switching = true
        try {
          await this.ensureAdminHttpLogin()
        } catch (e) {
          if (e && e.message === 'cancelled') {
            this.$message.info('已取消')
          } else {
            this.$message.warning((e && e.message) || '无管理端权限')
          }
          return
        } finally {
          this.switching = false
        }
      }

      const onConversation =
        this.$route.path === '/conversation' || this.$route.name === 'conversation'

      // 已在客服端且已在聚合聊天 → 无需动作；路由仍停在 /admin 等时必须纠正（用户截图症状）
      if (
        panel === 'client' &&
        this.activePanel === 'client' &&
        this.webSocketToken &&
        onConversation
      ) {
        return
      }
      if (panel === 'admin' && this.activePanel === 'admin') return

      if (panel === 'client') {
        this.switching = true
        try {
          if (!this.webSocketToken) {
            await this.ensureClientWsLogin()
          }
          if (!this.webSocketToken) return

          const router = this.$router
          const store = this.$store
          if (!onConversation) {
            await router.replace({ path: '/conversation' }).catch((err) => {
              console.warn('[AppModeSwitch] replace /conversation failed', err)
            })
          }
          const landed =
            this.$route.path === '/conversation' || this.$route.name === 'conversation'
          if (!landed) {
            await router.replace({ path: '/conversation' }).catch((err) => {
              console.warn('[AppModeSwitch] retry replace /conversation failed', err)
            })
          }
          const landedFinal =
            this.$route.path === '/conversation' || this.$route.name === 'conversation'
          if (!landedFinal) {
            this.$message.warning('进入客服端失败，请重试')
            return
          }
          store.commit('SET_ACTIVE_PANEL', 'client')
          store.commit('SET_CLIENT_OR_SERVER', 'client')
          store.dispatch('conversation/FetchWechatsList')
          store.dispatch('websocket/GetWeChatsReq')
        } catch (e) {
          if (e && e.message === 'cancelled') {
            this.$message.info('已取消')
          } else if (e && e.message === 'auth failed') {
            this.$message.error('客服端登录失败，请检查账号密码')
          } else if (e && e.message) {
            this.$message.warning(e.message)
          }
        } finally {
          this.switching = false
        }
        return
      }

      this.$store.commit('SET_ACTIVE_PANEL', panel)
      if (this.$route.path && this.$route.name !== 'admin') {
        localStorage.setItem('lastClientRoute', this.$route.path)
      }
      this.$router.replace({ name: 'admin' })
    }
  }
}
</script>

<style lang="scss" scoped>
.app-mode-switch {
  display: flex;
  align-items: center;
  margin-right: 16px;
  border-radius: 4px;
  overflow: hidden;

  .mode-tab {
    padding: 4px 14px;
    font-size: 14px;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;
  }

  &.theme-dark {
    border: 1px solid rgba(255, 255, 255, 0.35);

    .mode-tab {
      color: rgba(255, 255, 255, 0.75);

      &:hover:not(.disabled) {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }

      &.active {
        color: #fff;
        background: rgba(255, 255, 255, 0.2);
      }

      &.disabled {
        color: rgba(255, 255, 255, 0.35);
        cursor: not-allowed;
      }
    }
  }

  &.theme-light {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    background: #fff;

    .mode-tab {
      color: #606266;

      &:hover:not(.disabled) {
        color: $accent-admin;
        background: #e6f0fa;
      }

      &.active {
        color: #fff;
        background: $accent-admin;
      }

      &.disabled {
        color: #c0c4cc;
        cursor: not-allowed;
      }
    }
  }
}
</style>
