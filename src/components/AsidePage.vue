<template>
  <el-aside class="aside-page" width="150px">
    <!-- 会话页面的nav -->
    <div class="aside-wechats">
      <!-- 微信总数 -->
      <div class="aside-wechats-title">
        <i class="fa fa-weixin fa-lg" aria-hidden="true"></i>
        <p class="can-not-select">{{ wechatsOnline.length }}/{{ wechats.length }}</p>
      </div>

      <div class="aside-wechats-config">
        <el-tooltip content="勾选后优先显示设备备注，未设置备注时显示昵称" placement="top">
          <el-checkbox v-model="showDevNickValue" class="config-item">
            显示设备备注
          </el-checkbox>
        </el-tooltip>
      </div>

      <!-- 微信列表 -->
      <ul class="wechats-list scroll">
        <li
          class="wechat-item"
          :index="wechat.WxId"
          v-for="(wechat, index) in wechats"
          :key="index"
          :class="[
            { 'wechat-chose': sameWxId(wechat.WxId, currentWeChatId) },
            {
              'item-disabled': !isWechatOnline(wechat)
            }
          ]"
          @click="choseWechat(wechat)"
          :title="wechatTitle(wechat)"
        >
          <!-- 微信头像 -->
          <div class="avatar-messages">
            <img
              class="wechat-avatar"
              :src="wechat.Avatar || avatarFallback"
              alt="微信头像"
            />
            <p class="ellipsis wechat-name">{{ displayWechatName(wechat) }}</p>
            <!-- 未读消息 -->
            <span
              class="new-message-notice"
              v-if="messagesNotRead[wechat.WxId]"
              v-text="messagesNotRead[wechat.WxId]"
            ></span>
            <!-- 离线标志 -->
            <span
              v-if="!isWechatOnline(wechat)"
              class="iconfont jubo-off-line"
              :class="{
                'item-disabled': !isWechatOnline(wechat)
              }"
            ></span>
          </div>
        </li>
      </ul>

      <!-- 加密连接状态（对齐 kelailaichatpc LeftAsidePage） -->
      <div class="ws-status-box" :class="wsStatusClass" :title="wsStatusTitle">
        <el-icon><Lock /></el-icon>
        <span class="ws-status-text">加密连接：{{ wsStatusText }}</span>
        <el-button
          v-if="webSocketState !== 1 && webSocketState !== 0"
          link
          size="small"
          class="ws-retry-btn"
          @click="handleRetryWebSocket"
        >
          重连
        </el-button>
      </div>
      <div v-if="webSocketState === 0" class="ws-loading-mask">
        <div class="ws-loading-content">
          <el-icon class="ws-loading-icon is-loading"><Loading /></el-icon>
          <span class="ws-loading-text">正在建立加密连接，请稍候...</span>
        </div>
      </div>
    </div>
  </el-aside>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { ElMessage } from 'element-plus'
import { Loading, Lock } from '@element-plus/icons-vue'
import { TriggerConversationPushTask, TriggerContactPushTask, TriggerCustomerPushTask } from '../api/webSocketApi'
import { normalizeWxId, sameWxId, wechatDisplayName, isWechatOnline } from '@/utils/wechat'
import avatarFallback from '@/assets/svg/conversation-image-error.svg'
import { retryWebSocketConnection } from '@/websocket/websocket'

export default {
  components: { Loading, Lock },
  data() {
    return {
      avatarFallback,
      /** 同 wxId 3s 内不重复 Trigger，减轻双号切换时派发池压力 */
      _prefetchAt: Object.create(null)
    }
  },
  computed: {
    ...mapState({
      webSocketState: 'webSocketState',
      webSocketToken: 'webSocketToken',
      activePanel: 'activePanel'
    }),
    ...mapGetters({
      wechats: 'conversation/wechats', // 会话页面 当前用户绑定的微信
      wechatsOnline: 'conversation/wechatsOnline', // 会话页面 已经登陆的微信
      currentWeChatId: 'conversation/currentWeChatId', // 会话页面 选中的微信的id
      messagesNotRead: 'conversation/messagesNotRead', // 会话页面 新消息
      showDevNick: 'showDevNick'
    }),
    showDevNickValue: {
      get() {
        return this.showDevNick
      },
      set(value) {
        this.$store.commit('SET_SHOW_DEV_NICK', value)
      }
    },
    wsStatusText() {
      if (this.webSocketState === 1) return '已连接'
      if (this.webSocketState === 0) return '自动重连中'
      return '断开'
    },
    wsStatusClass() {
      return this.webSocketState === 1 ? 'is-connected' : 'is-disconnected'
    },
    wsStatusTitle() {
      const url = process.env.VUE_APP_WEBSOCKET_URL || ''
      return url ? `WebSocket: ${url}` : 'WebSocket 未配置'
    }
  },
  mounted() {
    this.loadWechatsIfEmpty()
  },
  watch: {
    // WS 鉴权成功但列表仍空时补拉（硬刷新 / 重连丢 GetWeChatsResp）
    webSocketToken(token) {
      if (token) this.loadWechatsIfEmpty()
    },
    webSocketState(state) {
      if (state === 1) this.loadWechatsIfEmpty()
    },
    // 有在线号时：先自动选中当前号，右侧会话区立刻绑定；其它号后台预热
    wechatsOnline: {
      immediate: true,
      handler(newVal, oldVal) {
        const online = newVal || []
        if (online.length === 0) return

        const isFirst = oldVal === undefined
        const currentId = normalizeWxId(this.currentWeChatId)
        const selected =
          (currentId && online.find((w) => sameWxId(w.WxId, currentId))) || online[0]
        // 未选中 / 当前号已离线 / 侧栏刚挂载 → 必须 choseWechat，否则右侧空白只能再点头像
        if (!sameWxId(selected.WxId, currentId) || isFirst) {
          this.choseWechat(selected)
        }

        const prevIds = new Set((oldVal || []).map((w) => normalizeWxId(w.WxId)))
        const newcomers = isFirst
          ? online
          : online.filter((w) => !prevIds.has(normalizeWxId(w.WxId)))
        for (const wechat of newcomers) {
          if (sameWxId(wechat.WxId, selected.WxId)) continue
          this.prefetchWechat(wechat.WxId)
        }
      }
    }
  },
  methods: {
    /** HTTP 首屏拉企微号；WS 就绪时顺带补发 WS GetWeChatsReq 同步在线态 */
    loadWechatsIfEmpty() {
      if (this.activePanel === 'admin') return
      if (this.wechats && this.wechats.length > 0) return
      this.$store.dispatch('conversation/FetchWechatsList')
      if (this.webSocketToken && this.webSocketState === 1) {
        this.$store.dispatch('websocket/GetWeChatsReq')
      }
    },
    displayWechatName(wechat) {
      return wechatDisplayName(wechat, this.showDevNick)
    },
    wechatTitle(wechat) {
      const remark = String(wechat?.devnickname || '').trim()
      if (remark && wechat?.Name) {
        return `${remark}（${wechat.Name}）`
      }
      return remark || wechat?.Name || ''
    },
    sameWxId,
    isWechatOnline,
    handleRetryWebSocket() {
      const wsUrl = process.env.VUE_APP_WEBSOCKET_URL
      if (!wsUrl) {
        ElMessage.error('未配置 WebSocket 地址，无法重连')
        return
      }
      if (this.webSocketState === 0) {
        ElMessage.info('加密连接自动重连中，请稍候...')
        return
      }
      const ok = retryWebSocketConnection(wsUrl)
      if (ok) {
        ElMessage.success('已发起加密连接重连，请稍候...')
      } else {
        ElMessage.error('重连失败，请稍后重试')
      }
    },
    /** HTTP 镜像先出列表（分页），再向手机 Trigger 拉最新 + 通讯录/客户 */
    async prefetchWechat(wxId) {
      if (!wxId) return
      const key = String(wxId)
      const now = Date.now()
      const last = this._prefetchAt[key] || 0
      if (now - last < 3000) return
      this._prefetchAt[key] = now
      TriggerConversationPushTask(wxId)
      try {
        await this.$store.dispatch('conversation/LoadConversationSnapshot', {
          wxId,
          maxRecords: 300
        })
      } catch (e) {
        // 镜像失败不阻断 Trigger
      }
      TriggerContactPushTask(wxId)
      TriggerCustomerPushTask(wxId)
    },
    // 选择微信
    choseWechat(wechat) {
      if (!wechat) return
      if (!isWechatOnline(wechat)) {
        this.$alert('手机微信不在线，请检查手机！', '提示', { type: 'warning' })
        return
      }
      const WxId = wechat.WxId
      // 始终写入当前号，保证右侧列表/会话区立刻绑定（避免仅预热未选中）
      this.$store.commit('conversation/SET_CURRENT_WECHAT', wechat)
      this.$store.dispatch('conversation/SetCurrentCustomers', WxId)
      this.$store.dispatch('conversation/SetCurrentContacts', WxId)
      this.prefetchWechat(WxId)
    }
  }
}
</script>

<style lang="scss" scoped>
.aside-page {
  overflow: hidden;
  background-color: $bg-color-content-base;
  border-right: solid $border-color-base 2px;

  .aside-wechats {
    height: 100%;
    width: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    flex-direction: column;
    position: relative;

    .aside-wechats-title {
      display: flex;
      justify-content: space-around;
      align-items: center;
      height: 40px;
      min-height: 40px;
      width: 100%;
      border-bottom: solid $border-color-base 2px;
    }

    .aside-wechats-config {
      width: 100%;
      padding: 4px 6px;
      border-bottom: solid $border-color-base 1px;
      flex-shrink: 0;

      .config-item {
        margin: 0;
        height: auto;

        :deep(.el-checkbox__label) {
          font-size: 11px;
          line-height: 1.2;
          padding-left: 4px;
        }
      }
    }

    .wechats-list {
      width: 100%;
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      flex-direction: column;
      overflow-y: auto;
      .wechat-item {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 5px;

        color: $font-color-2;
        cursor: pointer;
        &:hover {
          background-color: rgba($color: #000000, $alpha: 0.1);
        }

        .avatar-messages {
          position: relative;
          padding: 5px 5px 0 5px;
          display: flex;
          flex-direction: column;
          align-items: center;

          .wechat-avatar {
            width: 42px;
            height: 42px;
            border-radius: 5px;
          }

          .wechat-name {
            margin-top: 2px;
            max-width: 100px;
          }

          .new-message-notice {
            color: #fff;
            position: absolute;
            top: 0px;
            right: 0px;
            height: 20px;
            min-width: 20px;
            padding: 0 5px;
            line-height: 20px;
            text-align: center;
            background: red;
            border-radius: 10px;
          }
          .jubo-off-line {
            position: absolute;
            top: 0;
            left: 0;
          }
        }
      }

      .wechat-chose {
        background: rgba(16, 185, 129, 0.1);
        color: $accent-conv;
        border-left: 3px solid $accent-conv;
        &:hover {
          background: rgba(16, 185, 129, 0.12);
        }
      }

      .item-disabled {
        cursor: not-allowed;
        .wechat-avatar {
          filter: grayscale(1);
        }
        .jubo-off-line {
          color: red;
        }
      }
    }
  }

  .ws-status-box {
    margin: 6px;
    padding: 6px 8px;
    width: calc(100% - 12px);
    display: flex;
    align-items: center;
    border-radius: 6px;
    background: #f3f3f3;
    border: 1px solid #eee;
    font-size: 11px;
    color: #909399;
    user-select: none;
    flex-shrink: 0;

    .el-icon {
      margin-right: 4px;
      font-size: 14px;
    }

    &.is-connected {
      color: #13ce66;
    }

    &.is-disconnected {
      color: #909399;
    }

    .ws-status-text {
      flex: 1;
      line-height: 1.2;
      min-width: 0;
    }

    .ws-retry-btn {
      margin-left: 4px;
      padding: 0;
      font-size: 11px;
    }
  }

  .ws-loading-mask {
    position: absolute;
    inset: 0;
    z-index: 30;
    background: rgba(255, 255, 255, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;

    .ws-loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px;
      font-size: 12px;
      color: #606266;
    }

    .ws-loading-icon {
      font-size: 22px;
      color: $accent-conv;
    }
  }
}
</style>
