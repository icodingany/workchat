<template>
  <div class="mobile-login-box">
    <!-- 动态背景粒子 -->
    <canvas ref="particleCanvas" class="particle-canvas"></canvas>

    <div class="login-container">
      <img class="logo" src="@/assets/logo.png" alt="企聊客服" />

      <div class="login-form">
        <div class="input-group">
          <span class="input-icon">👤</span>
          <input
            v-model.trim="loginForm.name"
            class="mobile-input"
            maxlength="30"
            placeholder="请输入账号"
            type="text"
          />
        </div>
        <div class="input-group">
          <span class="input-icon">🔒</span>
          <input
            v-model.trim="loginForm.pass"
            class="mobile-input"
            maxlength="30"
            :type="isPasswordVisible ? 'text' : 'password'"
            placeholder="请输入密码"
          />
          <span class="toggle-pwd" @click="isPasswordVisible = !isPasswordVisible">
            {{ isPasswordVisible ? '👁' : '👁‍🗨' }}
          </span>
        </div>

        <div class="options-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="rememberPwd" />
            <span>记住密码</span>
          </label>
        </div>

        <div class="error-text" v-if="errorText">{{ errorText }}</div>

        <button
          class="login-btn client-btn"
          :disabled="logined"
          @click="handleClientLogin"
        >
          <span v-if="logined && loginType === 'client'" class="btn-loading"></span>
          {{ logined && loginType === 'client' ? '登录中...' : '客户端登录' }}
        </button>

        <button
          class="login-btn admin-btn"
          :disabled="logined"
          @click="handleAdminLogin"
        >
          <span v-if="logined && loginType === 'server'" class="btn-loading"></span>
          {{ logined && loginType === 'server' ? '登录中...' : '管理端登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'
import { mapState, mapMutations } from 'vuex'
import { login } from '@/api/httpApiAdmin'
import { createWebSocket } from '@/websocket/websocket'
import { deviceAuthReq } from '@/api/webSocketApi'

export default {
  name: 'MobileLogin',
  data() {
    return {
      loginForm: { name: '', pass: '' },
      rememberPwd: false,
      isPasswordVisible: false,
      logined: false,
      loginType: 'client',
      errorText: '',
      particles: []
    }
  },
  computed: {
    ...mapState({
      webSocketState: 'webSocketState',
      webSocketToken: 'webSocketToken',
      httpToken: 'httpToken'
    })
  },
  watch: {
    rememberPwd(val) {
      if (!val) {
        try {
          localStorage.removeItem('remarkPwdOfJuboChat')
          localStorage.removeItem('localNameOfJuboChat')
          localStorage.removeItem('localPwdOfJuboChat')
        } catch (_) {}
      }
    }
  },
  mounted() {
    this.initParticles()
    this.restoreCredentials()
  },
  methods: {
    ...mapMutations({
      SET_CLIENT_OR_SERVER: 'SET_CLIENT_OR_SERVER',
      SET_LOGIN_LOADING: 'websocket/SET_LOGIN_LOADING'
    }),
    restoreCredentials() {
      try {
        const name = localStorage.getItem('localNameOfJuboChat') || ''
        const pass = localStorage.getItem('localPwdOfJuboChat') || ''
        if (name && pass) {
          this.rememberPwd = true
          this.loginForm.name = name
          this.loginForm.pass = pass
        }
      } catch (_) {}
    },
    persistCredentials() {
      try {
        if (this.rememberPwd) {
          localStorage.setItem('localNameOfJuboChat', this.loginForm.name)
          localStorage.setItem('localPwdOfJuboChat', this.loginForm.pass)
          localStorage.setItem('remarkPwdOfJuboChat', '1')
        } else {
          localStorage.removeItem('remarkPwdOfJuboChat')
          localStorage.removeItem('localNameOfJuboChat')
          localStorage.removeItem('localPwdOfJuboChat')
        }
      } catch (_) {}
    },
    saveSessionCredentials() {
      try {
        sessionStorage.setItem('sessionNameOfJuboChat', this.loginForm.name)
        sessionStorage.setItem('sessionPwdOfJuboChat', this.loginForm.pass)
      } catch (_) {}
    },
    waitForStoreValue(getter, predicate, { timeoutMs = 12000, label = '等待中' } = {}) {
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
            } catch (e) {}
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
          clearTimeout(timer)
          if (unwatch) unwatch()
        }
      })
    },
    async ensureWebSocketConnected(timeoutMs = 12000) {
      if (this.$store.state.webSocketState === 1) return
      createWebSocket(process.env.VUE_APP_WEBSOCKET_URL)
      await this.waitForStoreValue(
        () => this.$store.state.webSocketState,
        (v) => v === 1,
        { timeoutMs, label: 'WebSocket连接' }
      )
    },
    async doWebSocketAuthAndWaitToken({ timeoutMs = 12000 } = {}) {
      if (this.$store.state.webSocketToken) return
      deviceAuthReq(this.loginForm.name, this.loginForm.pass)
      await this.waitForStoreValue(
        () => this.$store.state.webSocketToken,
        (t) => !!t && String(t).trim() !== '',
        { timeoutMs, label: 'WebSocket认证' }
      )
    },
    async connectAndAuthWebSocketWithRetry({ timeoutMs = 20000, maxAttempts = 2 } = {}) {
      try {
        sessionStorage.setItem('wsAuthInProgress', '1')
      } catch (e) {
        /* ignore */
      }
      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            this.errorText = ''
            await this.ensureWebSocketConnected(timeoutMs)
            await this.doWebSocketAuthAndWaitToken({ timeoutMs })
            return
          } catch (e) {
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1000))
              continue
            }
            this.errorText = `连接失败，请检查网络后重试`
          }
        }
      } finally {
        try {
          sessionStorage.removeItem('wsAuthInProgress')
        } catch (e) {
          /* ignore */
        }
      }
    },
    async handleClientLogin() {
      if (!this.loginForm.name || !this.loginForm.pass) {
        ElMessage.warning('请输入账号和密码')
        return
      }
      this.logined = true
      this.loginType = 'client'
      this.errorText = ''

      try {
        const res = await login(this.loginForm.name, this.loginForm.pass)
        if (res.code === 0) {
          this.saveSessionCredentials()
          this.persistCredentials()
          this.$store.commit('SET_HTTP_TOKEN', res.data.token)
          // 兼容: 激活码认证
          if (typeof acceptRegCodeAuth === 'function') {
            acceptRegCodeAuth(res.data)
          }
          this.$store.commit('SET_ADMIN_INO', res.data)
          this.SET_CLIENT_OR_SERVER('client')

          try {
            await this.connectAndAuthWebSocketWithRetry({ timeoutMs: 20000 })
            this.$router.push('/conversation')
          } catch (e) {
            // 错误已在 errorText 中显示
            this.logined = false
          }
        } else {
          ElMessage.error(res.msg || '登录失败')
          this.logined = false
        }
      } catch (error) {
        ElMessage.error('登录失败')
        this.logined = false
      }
    },
    async handleAdminLogin() {
      if (!this.loginForm.name || !this.loginForm.pass) {
        ElMessage.warning('请输入账号和密码')
        return
      }
      this.logined = true
      this.loginType = 'server'
      this.errorText = ''

      try {
        const res = await login(this.loginForm.name, this.loginForm.pass)
        if (res.code === 0) {
          this.saveSessionCredentials()
          this.persistCredentials()
          this.$store.commit('SET_HTTP_TOKEN', res.data.token)
          if (typeof acceptRegCodeAuth === 'function') {
            acceptRegCodeAuth(res.data)
          }
          this.$store.commit('SET_ADMIN_INO', res.data)
          this.SET_CLIENT_OR_SERVER('server')
          this.$router.push('/admin')
        } else {
          ElMessage.error(res.msg || '登录失败')
        }
      } catch (error) {
        ElMessage.error('登录失败')
      } finally {
        this.logined = false
      }
    },
    initParticles() {
      const canvas = this.$refs.particleCanvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const count = 40
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 1,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2
        })
      }
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        this.particles.forEach((p, i) => {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(0, 102, 204, ${p.opacity})`
          ctx.fill()
          for (let j = i + 1; j < this.particles.length; j++) {
            const dx = this.particles[j].x - p.x
            const dy = this.particles[j].y - p.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 100) {
              ctx.beginPath()
              ctx.strokeStyle = `rgba(0, 102, 204, ${0.15 * (1 - dist / 100)})`
              ctx.lineWidth = 0.5
              ctx.moveTo(p.x, p.y)
              ctx.lineTo(this.particles[j].x, this.particles[j].y)
              ctx.stroke()
            }
          }
        })
        requestAnimationFrame(animate)
      }
      animate()
      window.addEventListener('resize', () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-login-box {
  width: 100%;
  min-height: 100vh;
  height: 100%;
  background: radial-gradient(ellipse at top, #0f1729 0%, #050a14 50%, #000000 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 40px 0;
  box-sizing: border-box;
  position: relative;

  &::before {
    content: '';
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-image:
      linear-gradient(rgba(0, 174, 255, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 174, 255, 0.08) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: gridMove 25s linear infinite;
    pointer-events: none;
    z-index: 0;
  }

  &::after {
    content: '';
    position: fixed;
    top: 50%; left: 50%;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(0, 174, 255, 0.15) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 1;
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes gridMove {
    0% { transform: translate(0, 0); }
    100% { transform: translate(50px, 50px); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
  }

  .particle-canvas {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 1;
    opacity: 0.8;
  }

  .login-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0 20px;
    position: relative;
    z-index: 2;
  }

  .logo {
    width: 160px;
    height: auto;
    margin-bottom: 32px;
    filter: drop-shadow(0 0 20px rgba(0, 174, 255, 0.35));
    animation: logoFloat 3s ease-in-out infinite;
  }

  @keyframes logoFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .login-form {
    width: 100%;
    max-width: 400px;
    background: linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(5,10,20,0.95) 100%);
    border-radius: 20px;
    padding: 36px 28px 32px;
    box-shadow: 0 0 0 1px rgba(0,174,255,0.2), 0 8px 32px rgba(0,0,0,0.6);
    backdrop-filter: blur(40px);
    animation: fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s backwards;

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 60%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0,174,255,0.8), transparent);
      border-radius: 2px;
      animation: topGlow 3s ease-in-out infinite;
    }

    @keyframes topGlow {
      0%, 100% { opacity: 0.5; width: 60%; }
      50% { opacity: 1; width: 80%; }
    }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(40px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .input-group {
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 12px;
    margin-bottom: 16px;
    padding: 0 14px;
    transition: all 0.3s;

    &:focus-within {
      background: rgba(255,255,255,0.12);
      border-color: #00aeff;
      box-shadow: 0 0 0 3px rgba(0,174,255,0.15);
    }

    .input-icon {
      font-size: 18px;
      margin-right: 10px;
      opacity: 0.6;
    }

    .mobile-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: #fff;
      font-size: 16px;
      padding: 14px 0;
      line-height: 1.2;
      width: 100%;

      &::placeholder {
        color: rgba(255,255,255,0.35);
      }
    }

    .toggle-pwd {
      font-size: 18px;
      opacity: 0.5;
      cursor: pointer;
      padding: 4px;
    }
  }

  .options-row {
    display: flex;
    justify-content: flex-end;
    margin: 12px 0 20px;

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: rgba(255,255,255,0.6);
      font-size: 13px;

      input[type="checkbox"] {
        accent-color: #00aeff;
        width: 16px;
        height: 16px;
      }
    }
  }

  .error-text {
    padding: 10px 14px;
    margin-bottom: 12px;
    background: rgba(238,10,36,0.12);
    border: 1px solid rgba(238,10,36,0.4);
    border-radius: 10px;
    font-size: 13px;
    color: rgba(255,255,255,0.95);
    text-align: center;
  }

  .login-btn {
    width: 100%;
    height: 50px;
    border: none;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    -webkit-tap-highlight-color: transparent;

    &:active {
      transform: scale(0.97);
    }

    &:disabled {
      opacity: 0.7;
    }

    .btn-loading {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  }

  .client-btn {
    background: linear-gradient(135deg, #00aeff 0%, #0066cc 100%);
    color: #fff;
    margin-bottom: 12px;
    box-shadow: 0 8px 24px rgba(0,174,255,0.35);
  }

  .admin-btn {
    background: linear-gradient(135deg, #ff6b35 0%, #e96500 100%);
    color: #fff;
    box-shadow: 0 8px 24px rgba(255,107,53,0.35);
  }
}

@media (max-width: 480px) {
  .mobile-login-box {
    padding: 30px 0;
  }
  .login-form {
    padding: 28px 20px;
  }
  .logo {
    width: 120px;
    margin-bottom: 28px;
  }
}
</style>