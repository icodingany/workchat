<template>
  <div id="app" @contextmenu.prevent>
    <!-- 移动端：全屏路由视图，无壳 -->
    <template v-if="mobile">
      <div class="mobile-box">
        <router-view></router-view>
      </div>
    </template>
    <!-- PC 端：原有布局 -->
    <template v-else>
      <template v-if="webSocketToken || httpToken">
        <!-- 客服端（activePanel=client；WS 重连中 token 可能短暂为空，仍保持客服壳） -->
        <template v-if="activePanel === 'client'">
          <header-page v-if="!ssoEmbedded"></header-page>
          <el-container class="el-container">
            <aside-page v-if="!ssoEmbedded"></aside-page>
            <router-view name="main"></router-view>
          </el-container>
        </template>
        <!-- 管理端 -->
        <template v-else-if="httpToken && activePanel === 'admin'">
          <router-view name="admin"></router-view>
        </template>
        <!-- 仅有客服端权限时回退 -->
        <template v-else-if="webSocketToken">
          <header-page v-if="!ssoEmbedded"></header-page>
          <el-container class="el-container">
            <aside-page v-if="!ssoEmbedded"></aside-page>
            <router-view name="main"></router-view>
          </el-container>
        </template>
      </template>

      <!-- 登陆页面 -->
      <template v-else>
        <router-view name="login"></router-view>
      </template>
    </template>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { createWebSocket, closeWebsocket, isReconnectForbidden } from './websocket/websocket.js'
import { heartBeatReq, deviceAuthReq } from './api/webSocketApi'
import { checkVersionUpdate } from './utils/versionChecker'
import { isMobile } from './utils/deviceDetector'
import { releaseWsSessionOwnerIfHeld } from './utils/wsSessionOwner'
import { isSsoEmbedded } from './utils/ssoEmbedded'
import { initWecomEmbedBridge } from './utils/wecomEmbedBridge'
import {
  checkElectronUpdateOnLogin,
  resetElectronUpdateLoginCheck,
  onUpdaterEvent,
  quitAndInstall,
  isElectron
} from './utils/electronUpdater'

import HeaderPage from '@/components/HeaderPage.vue'
import AsidePage from '@/components/AsidePage.vue'
// import FooterPage from '@/components/FooterPage.vue'

export default {
  name: 'App',
  data() {
    return {
      heartTimer: null, // 心跳检测
      autoDeviceAuthTried: false, // 刷新后用会话凭据自动补登 WS，只试一次
      unsubUpdater: null,
      updatePromptShown: false
    }
  },
  components: {
    HeaderPage,
    AsidePage
  },
  computed: {
    ...mapState({
      currentMode: 'currentMode',
      webSocketState: 'webSocketState',
      webSocketToken: 'webSocketToken',
      httpToken: 'httpToken',
      activePanel: 'activePanel'
    }),
    ...mapGetters({
      isDesktop: 'isDesktop'
    }),
    mobile() {
      return isMobile()
    },
    // 客徕徕内嵌（iframe + SSO）：隐藏本端顶栏/账号栏，账号列表与切换由宿主提供
    ssoEmbedded() {
      return isSsoEmbedded() && window.parent !== window.self
    }
  },
  methods: {
    syncMobileBodyClass() {
      const cls = 'workchat-mobile'
      if (this.mobile) {
        document.body.classList.add(cls)
      } else {
        document.body.classList.remove(cls)
      }
    },
    ensureValidActivePanel() {
      if (!this.httpToken || this.webSocketToken) return
      try {
        if (sessionStorage.getItem('wsAuthInProgress') === '1') return
      } catch (e) {
        /* ignore */
      }
      // 用户已在客服端：WS 重连/补登期间勿因 token 短暂为空切到管理端（对齐 kelailaichatpc）
      if (this.activePanel === 'client') return
      if (this.activePanel !== 'admin') {
        this.$store.commit('SET_ACTIVE_PANEL', 'admin')
      }
      // 移动端管理端功能页是独立路由（meta.adminFeature），同样合法，勿弹回 /admin
      if (
        this.$route.name !== 'admin' &&
        !this.$route.meta.adminFeature &&
        this.$route.name !== 'login'
      ) {
        this.$router.replace({ name: 'admin' })
      }
    },
    /**
     * 客服端壳却停在无 main 视图的路由（#/admin、#/login、未匹配路径）：
     * 主区一片空白、聚合聊天无选中。统一纠正到 /conversation（默认聚合聊天）。
     * /login 常见于 SSO 兑换窗口：httpToken 先落、WS token 未到（或二次进入带旧 token）。
     * 未登录（双 token 皆空）不纠正——登录页须正常显示；移动端路由无 main 命名视图，跳过。
     */
    ensureClientOnConversation() {
      if (this.activePanel !== 'client') return
      if (!this.webSocketToken && !this.httpToken) return
      if (this.mobile) return
      const matched = (this.$route && this.$route.matched) || []
      const hasMainView = matched.some((m) => m.components && m.components.main)
      if (!hasMainView) {
        this.$router.replace({ path: '/conversation' }).catch(() => {})
      }
    },
    /**
     * 已有管理端登录态但缺 webSocketToken 时，用会话凭据自动 DeviceAuth。
     * 覆盖：刷新后 httpToken 恢复、或登录时 WS 偶发失败。
     */
    tryAutoDeviceAuth() {
      if (this.autoDeviceAuthTried) return
      if (isReconnectForbidden()) return
      if (this.webSocketState !== 1 || this.webSocketToken || !this.httpToken) return
      try {
        if (sessionStorage.getItem('wsAuthInProgress') === '1') return
      } catch (e) {
        /* ignore */
      }
      const ul = this.$store.state.unifiedLogin
      if (ul && ul.pending) return
      let name = ''
      let pass = ''
      try {
        name =
          sessionStorage.getItem('sessionNameOfJuboChat') ||
          localStorage.getItem('localNameOfJuboChat') ||
          ''
        pass =
          sessionStorage.getItem('sessionPwdOfJuboChat') ||
          localStorage.getItem('localPwdOfJuboChat') ||
          ''
      } catch (e) {
        return
      }
      if (!name || !pass) return
      this.autoDeviceAuthTried = true
      // 标记自动补登：msgHandler 收到 Error 时静默（避免刷新弹「解码失败」误导）
      try {
        sessionStorage.setItem('autoDeviceAuthPending', '1')
      } catch (e) {
        /* ignore */
      }
      deviceAuthReq(name, pass)
    },
    /** 登录后主动检查一次版本（Web：对比 version.json 决定是否硬刷新；Electron：electron-updater） */
    checkVersionOnceAfterLogin() {
      if (this.isDesktop || isElectron()) {
        checkElectronUpdateOnLogin()
        return
      }
      try {
        checkVersionUpdate()
      } catch (e) {
        console.warn('[版本] 登录后版本检查失败:', e)
      }
    },
    bindElectronUpdater() {
      if (!(this.isDesktop || isElectron())) return
      if (this.unsubUpdater) return
      this.unsubUpdater = onUpdaterEvent((event) => {
        if (!event || !event.type) return
        if (event.type === 'update-downloaded') {
          if (this.updatePromptShown) return
          this.updatePromptShown = true
          const ver = (event.info && event.info.version) || ''
          this.$confirm(
            `更新包${ver ? ' v' + ver : ''}已下载完成。是否立即退出并安装？也可稍后退出应用时自动安装。`,
            '发现新版本',
            {
              confirmButtonText: '退出并安装',
              cancelButtonText: '稍后',
              type: 'info',
              distinguishCancelAndClose: true
            }
          )
            .then(() => {
              quitAndInstall()
            })
            .catch(() => {
              this.$message({
                type: 'info',
                message: '已选择稍后安装。退出应用时将自动安装更新。',
                duration: 4000
              })
            })
        } else if (event.type === 'error') {
          console.warn('[autoUpdater]', event.message || event)
        }
      })
    }
  },
  watch: {
    mobile: {
      immediate: true,
      handler() {
        this.syncMobileBodyClass()
      }
    },
    activePanel(panel) {
      if (panel === 'admin' && !this.httpToken) {
        this.$store.commit('SET_ACTIVE_PANEL', 'client')
      }
      // 无 WS token 时不能停在 client 路由（/conversation 只有 main 出口，admin 出口为空 → 白屏）
      if (panel === 'client' && !this.webSocketToken && this.httpToken) {
        try {
          if (sessionStorage.getItem('wsAuthInProgress') === '1') return
        } catch (e) {
          /* ignore */
        }
        this.tryAutoDeviceAuth()
        return
      }
      if (panel === 'client') {
        this.ensureClientOnConversation()
      }
    },
    '$route'() {
      this.ensureClientOnConversation()
    },
    // 监听websocket的状态
    webSocketState(val) {
      switch (val) {
        case 0:
          console.log('正在建立连接，还没有完成 默认值')
          break
        case 1:
          console.log('websocket连接成功')
          this.tryAutoDeviceAuth()
          break
        case 2:
          console.log('连接正在进行关闭握手，即将关闭')
          break
        case 3:
          console.log('连接已经关闭或者根本没有建立')
          this.autoDeviceAuthTried = false
          // 仅在确有客服 token、非登录页、且非短暂闪断时提示
          if (
            this.webSocketToken &&
            !this._wsClosedAlertOpen &&
            this.$route.name !== 'login'
          ) {
            this._wsClosedAlertOpen = true
            this.$alert('连接已经关闭, 请重新登录！', '提示', {
              showClose: false,
              closeOnClickModal: false,
              confirmButtonText: '确定',
              type: 'warning'
            })
              .then(() => {
                this._wsClosedAlertOpen = false
                this.$store.commit('SET_WEBSOCKET_TOKEN', '')
              })
              .catch(() => {
                this._wsClosedAlertOpen = false
              })
          }
          break
        default:
          break
      }
    },
    // 监听token
    webSocketToken(newToken, oldToken) {
      if (newToken === '') {
        clearInterval(this.heartTimer)
        this.heartTimer = null
        resetElectronUpdateLoginCheck()
        this.updatePromptShown = false
      }
      if (newToken) {
        this.autoDeviceAuthTried = false
        if (this.heartTimer) {
          clearInterval(this.heartTimer)
          this.heartTimer = null
        }
        // 心跳用 store 当前 token，避免重连后闭包仍是旧 channel id
        this.heartTimer = setInterval(() => {
          const t = this.$store.state.webSocketToken
          if (t) heartBeatReq(t)
        }, 30000)
        // 无 → 有：登录成功后检查发版
        if (!oldToken || String(oldToken).trim() === '') {
          this.checkVersionOnceAfterLogin()
        }
        this.ensureClientOnConversation()
      } else {
        // onclose 清 token 后须允许下次 onopen 再补登；否则 autoDeviceAuthTried 会挡住重连
        this.autoDeviceAuthTried = false
        if (this.httpToken) {
          // 对齐 kelailaichatpc：HTTP 仍有效时保持当前页，等待 WS 重连/补登
          if (this.activePanel === 'client') {
            this.tryAutoDeviceAuth()
            return
          }
          this.ensureValidActivePanel()
          this.tryAutoDeviceAuth()
          return
        }
        // 转到登录页面
        this.$router.replace({ name: 'login' })
        releaseWsSessionOwnerIfHeld()
        // 如果是桌面壳：调整窗口大小（不整页刷新）
        if (this.isDesktop) {
          // 退出登录的loading
          const loading = this.$loading({
            lock: true,
            text: '正在退出',
            spinner: 'el-icon-loading',
            background: 'rgba(0, 0, 0, 0.7)'
          })
          let ct = setTimeout(() => {
            loading.close()
            clearTimeout(ct)
            ct = null
          }, 2000)
          // 调整窗口大小
          // this.$ipcRenderer.send('operations', 'logout')
          closeWebsocket()
          let cws = setTimeout(() => {
            createWebSocket(process.env.VUE_APP_WEBSOCKET_URL)
            clearTimeout(cws)
            cws = null
          }, 1000)
        } else {
          // 重新加载页面
          window.location.reload()
        }
      }
    },
    // 监听管理端token
    httpToken(newToken, oldToken) {
      if (newToken) {
        console.log('httpToken', newToken)
        // 仅 HTTP 登录成功（无 WS）时也检查发版
        if ((!oldToken || String(oldToken).trim() === '') && !this.webSocketToken) {
          this.checkVersionOnceAfterLogin()
        }
        // SSO 兑换窗口：httpToken 先落、WS token 未到，壳已切客服端但路由可能仍停
        // 在 /login → 主区空白；立即纠正到聚合聊天（WS 回包后由统一登录再决策）
        this.ensureClientOnConversation()
      } else if (this.webSocketToken) {
        // 统一主页面：仅清除管理端 token 时切回客服端，不退出登录
        this.$store.commit('SET_ACTIVE_PANEL', 'client')
        if (this.$route.name === 'admin') {
          this.$router.replace({ name: 'conversation' })
        }
      } else {
        // 转到登录页面
        this.$router.replace({ name: 'login' })
        releaseWsSessionOwnerIfHeld()
        // 如果是桌面壳：调整窗口大小（不整页刷新）
        if (this.isDesktop) {
          const loading = this.$loading({
            lock: true,
            text: '正在退出',
            spinner: 'el-icon-loading',
            background: 'rgba(0, 0, 0, 0.7)'
          })
          let lct = setTimeout(() => {
            loading.close()
            clearTimeout(lct)
            lct = null
          }, 2000)
        } else {
          window.location.reload()
        }
      }
    }
  },
  mounted() {
    this.syncMobileBodyClass()
    // 客徕徕内嵌桥：握手供账号列表、接收切账号指令（仅 iframe+SSO 内嵌态激活）
    initWecomEmbedBridge()
    // 初次导航完成前 $route 仍是起点（path='/'），此时校正面板会把移动端管理端
    // 功能页（独立路由）误弹回 /admin；等路由就绪后再校正
    this.$router.isReady().then(() => {
      this.ensureValidActivePanel()
      this.ensureClientOnConversation()
    })
    this.bindElectronUpdater()
    // 如过浏览器支持websocket 创建连接
    if ('WebSocket' in window) {
      createWebSocket(process.env.VUE_APP_WEBSOCKET_URL)
    } else {
      //  如果浏览器不支持WebSocket
      this.$message({
        message: '您的浏览器不支持 WebSocket!，请更换浏览器！',
        type: 'error'
      })
    }
  },
  unmounted() {
    document.body.classList.remove('workchat-mobile')
    // 离开页面摧毁定时器
    clearInterval(this.heartTimer)
    this.heartTimer = null
    if (typeof this.unsubUpdater === 'function') {
      this.unsubUpdater()
      this.unsubUpdater = null
    }
  }
}
</script>

<style lang="scss">
@import './styles/reset.scss';
@import './styles/normalize.scss';
@import './styles/common.scss';
@import './styles/my-element-ui.scss';
@import './styles/mobile-admin-dialog.scss';
@import './styles/mobile-admin-page.scss';
@import './styles/qqface.scss';
@import '~@/assets/iconfont/iconfont.css';
@import '~@/assets/font-awesome/css/font-awesome.css';

#app {
  font-size: $font-size-base;
  color: $color-common;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'SF UI Text', 'Helvetica Neue', STHeiti,
    'Microsoft Yahei', Tahoma, Simsun, sans-serif;
  height: 100%;
  overflow: hidden;

  display: flex;
  flex-direction: column;
  justify-content: space-between;
  .el-container {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: white;
  }
}

.mobile-box {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: #f7f8fa;

  /* 子路由页（feature/admin 等）需撑满高度，否则顶栏 flex 布局会塌 */
  > * {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }
}
</style>
