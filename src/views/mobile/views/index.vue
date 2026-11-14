<template>
  <div class="index-container mobile-index" :style="{ height: viewportHeight }">
    <div v-show="page === 'index'" class="index-panel">
      <userHeader />
      <div class="index-content">
        <asideList
          v-show="!allConvs"
          :main-height="mainHeight"
          :all-convs-active="allConvs"
          @enter-all-convs="enterAllConvs"
          @exit-all-convs="exitAllConvs"
        />
        <div class="main" :style="{ height: mainHeight }">
          <ul v-if="!allConvs" class="tab-list">
            <li
              class="tab-item"
              :class="{ 'tab-item-active': currentTab === 'convs' }"
              @click="tabChange('convs')"
            >
              会话
            </li>
            <li
              class="tab-item"
              :class="{ 'tab-item-active': currentTab === 'friends' }"
              @click="tabChange('friends')"
            >
              通讯录
            </li>
            <li
              class="tab-item"
              :class="{ 'tab-item-active': currentTab === 'rooms' }"
              @click="tabChange('rooms')"
            >
              群聊
            </li>
          </ul>
          <div class="scrollable-content scroll">
            <ConvsList v-if="currentTab === 'convs' && !allConvs" />
            <ConvsListAll v-else-if="currentTab === 'convs' && allConvs" />
            <FriendsList v-else-if="currentTab === 'friends'" />
            <RoomsList v-else />
          </div>
        </div>
      </div>
    </div>
    <chat v-show="page === 'chat'" @toPage="toPage" />
    <manager v-show="page === 'manager'" @toPage="toPage" />
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'
import { mapGetters, mapState } from 'vuex'
import userHeader from '../components/index/userHeader.vue'
import asideList from '../components/index/asideList.vue'
import ConvsList from '../components/index/convsList.vue'
import ConvsListAll from '../components/index/convsListAll.vue'
import FriendsList from '../components/index/friendsList.vue'
import RoomsList from '../components/index/roomsList.vue'
import chat from './chat.vue'
import manager from './manager.vue'
import '../assets/css/common.css'
import { buildSlimSelectContact } from '@/utils/slimSelectContact'
import { normalizeWxId, sameWxId, isWechatOnline } from '@/utils/wechat'
import { TriggerConversationPushTask, TriggerContactPushTask } from '@/api/webSocketApi'

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b)
}

function wechatIdOf(w) {
  return normalizeWxId(w?.WxId || w?.WeChatId || w?.wxId)
}

export default {
  name: 'MobileIndex',
  components: { userHeader, asideList, ConvsList, ConvsListAll, FriendsList, RoomsList, chat, manager },
  provide() {
    return {
      mobileOpenChat: (message) => {
        this.page = 'chat'
      }
    }
  },
  data() {
    return {
      currentTab: 'convs',
      page: 'index',
      allConvs: false,
      viewportHeight: '100%',
      mainHeight: '100%'
    }
  },
  computed: {
    ...mapState('conversation', {
      wechats: 'wechats',
      currentCustomers: 'currentCustomers',
      currentContacts: 'currentContacts'
    }),
    ...mapState({
      webSocketToken: 'webSocketToken',
      webSocketState: 'webSocketState'
    }),
    ...mapGetters('conversation', {
      currentWeChatId: 'currentWeChatId',
      currentConvs: 'currentConvs',
      currentFriendId: 'currentFriendId',
      wechatsOnline: 'wechatsOnline'
    })
  },
  watch: {
    currentWeChatId: {
      immediate: true,
      handler(newVal) {
        if (newVal && !this.allConvs) {
          this.loadWechatData(newVal)
        }
      }
    },
    webSocketToken(token) {
      if (token) this.loadWechatsIfEmpty()
    },
    webSocketState(state) {
      if (state === 1) this.loadWechatsIfEmpty()
      // WS 刚连上且当前号会话仍空 → 补拉（进入客服端时常早于 WS 就绪）
      if (state === 1 && this.currentWeChatId && !this.allConvs && !this.currentConvs.length) {
        this.loadWechatData(this.currentWeChatId)
      }
    },
    wechatsOnline: {
      immediate: true,
      handler(online) {
        const list = online || []
        if (!list.length || this.allConvs) return
        const currentId = normalizeWxId(this.currentWeChatId)
        const selected =
          (currentId && list.find((w) => sameWxId(w.WxId, currentId))) || list[0]
        if (!selected) return
        if (!sameWxId(selected.WxId, currentId)) {
          this.$store.commit('conversation/SET_CURRENT_WECHAT', selected)
        }
      }
    }
  },
  mounted() {
    this.setViewportHeight()
    window.addEventListener('resize', this.setViewportHeight)
    this.loadWechats()
    if (this.$route.path === '/chat') {
      this.page = 'chat'
    }
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.setViewportHeight)
  },
  methods: {
    setViewportHeight() {
      this.viewportHeight = window.innerHeight + 'px'
      this.mainHeight = window.innerHeight - 100 + 'px'
    },
    toPage(val) {
      this.page = val
    },
    tabChange(tab) {
      this.currentTab = tab
      if (tab === 'convs' && this.currentWeChatId && !this.currentConvs.length) {
        this.loadWechatData(this.currentWeChatId)
      }
    },
    loadWechatsIfEmpty() {
      if (this.wechats && this.wechats.length > 0) return
      this.$store.dispatch('conversation/FetchWechatsList')
      if (this.webSocketToken && this.webSocketState === 1) {
        this.$store.dispatch('websocket/GetWeChatsReq')
      }
    },
    async loadWechats() {
      try {
        await this.$store.dispatch('conversation/FetchWechatsList')
        if (this.webSocketToken && this.webSocketState === 1) {
          this.$store.dispatch('websocket/GetWeChatsReq')
        }
        await this.waitForStoreValue(
          () => this.wechats && this.wechats.length > 0,
          (has) => !!has,
          { timeoutMs: 8000, label: '微信列表' }
        ).catch(() => {})
        const list = this.wechats || []
        if (list.length > 0) {
          let target = null
          try {
            const lastId = localStorage.getItem('lastSelectedWeChatId')
            if (lastId) {
              target = list.find((w) => sameWxId(wechatIdOf(w), lastId)) || null
            }
          } catch (e) {}
          if (!target) {
            const online = list.filter((w) => w && isWechatOnline(w))
            target = online[0] || list[0]
          }
          if (target) {
            this.$store.commit('conversation/SET_CURRENT_WECHAT', target)
          }
          this.triggerUnreadTasks(list)
        }
      } catch (e) {
        console.warn('[移动端] 加载微信列表失败:', e)
      }
    },
    waitForStoreValue(getter, predicate, { timeoutMs = 8000, label = '等待中' } = {}) {
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
    triggerUnreadTasks(wechatsList) {
      const ids = (wechatsList || []).map(wechatIdOf).filter(Boolean)
      ids.forEach((wechatId, idx) => {
        setTimeout(() => {
          try {
            TriggerConversationPushTask(wechatId)
          } catch (e) {}
        }, idx * 10)
      })
    },
    async loadWechatData(wxId) {
      const id = normalizeWxId(wxId)
      if (!id) return
      // 对齐 PC AsidePage.prefetchWechat + ConversationList.refreshConversation
      TriggerConversationPushTask(id)
      try {
        await this.$store.dispatch('conversation/LoadConversationSnapshot', {
          wxId: id,
          maxRecords: 300
        })
      } catch (e) {
        // HTTP 镜像失败不阻断 Trigger 拉手机端
      }
      try {
        TriggerContactPushTask(id)
        this.$store.dispatch('websocket/TriggerChatroomPushTask', id).catch(() => {})
      } catch (e) {}
      this.$store.dispatch('conversation/SetCurrentCustomers', id)
      this.$store.dispatch('conversation/SetAllContacts')
    },
    enterAllConvs() {
      this.allConvs = true
      const ids = (this.wechats || []).map(wechatIdOf).filter(Boolean)
      ids.forEach((wxId, idx) => {
        setTimeout(() => {
          try {
            TriggerConversationPushTask(wxId)
          } catch (e) {}
        }, idx * 15)
      })
    },
    exitAllConvs() {
      this.allConvs = false
    },
    choseFriend(message, allMode = false) {
      let wxid = message.WeChatId || message.WxId || message.wxid || this.currentWeChatId
      const remoteId = message.RemoteId || message.UserName || message.FriendId
      if (!wxid || !remoteId) {
        ElMessage.warning('会话信息不完整')
        return
      }

      if (allMode) {
        const wechat = (this.wechats || []).find(
          (w) => sameId(w.WeChatId || w.WxId, wxid)
        )
        if (wechat) {
          this.$store.commit('conversation/SET_CURRENT_WECHAT', wechat)
          wxid = wechat.WeChatId || wechat.WxId || wxid
        }
        this.allConvs = false
      }

      if (sameId(remoteId, this.currentFriendId) && sameId(wxid, this.currentWeChatId)) {
        this.page = 'chat'
        return
      }

      if (message.UnreadCnt > 0) {
        const readMsg = {
          WxId: wxid,
          RemoteId: remoteId,
          Id: message.Id
        }
        this.$store.dispatch('conversation/SetConvReaded', readMsg)
        this.$store.dispatch('websocket/TriggerMessageReadTask', readMsg).catch(() => {})
      }

      let otherInfo = {}
      const customers = this.currentCustomers || []
      const contacts = this.currentContacts || []
      const cust = customers.find((c) => sameId(c.RemoteId, remoteId))
      const contactRow = contacts.find((c) => sameId(c.RemoteId, remoteId))
      if (cust) otherInfo = cust
      else if (contactRow) otherInfo = contactRow

      const contact = buildSlimSelectContact(
        message,
        otherInfo,
        (cust && cust.LabelIds) || message.LabelIds || (otherInfo && otherInfo.LabelIds) || []
      )

      this.$store.commit('conversation/SET_CURRENT_FRIENDS', {
        wxid,
        contact
      })
      this.page = 'chat'
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-index.index-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
  background: #f7f8fa;
  transform: none !important;

  .index-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .index-content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: stretch;
    overflow: hidden;
  }

  .main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
    overflow: hidden;

    .tab-list {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      border-bottom: 1px solid #ebedf0;
      flex-shrink: 0;

      .tab-item {
        flex: 1;
        text-align: center;
        padding: 12px 0;
        font-size: 15px;
        color: #646566;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &.tab-item-active {
          color: #07c160;
          font-weight: 600;
          position: relative;

          &::after {
            content: '';
            position: absolute;
            left: 50%;
            bottom: 0;
            transform: translateX(-50%);
            width: 40px;
            height: 2px;
            background: #07c160;
            border-radius: 1px;
          }
        }
      }
    }

    .scrollable-content {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
  }
}
</style>
