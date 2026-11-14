<template>
  <div class="customer-list">
    <!-- 搜索 -->
    <div class="search-box">
      <el-input
        class="search-input"
        prefix-icon="el-icon-search"
        type="text"
        placeholder="请输入内容"
        maxlength="20"
        clearable
        show-word-limit
        v-model.lazy.trim="searchInfo"
      ></el-input>
    </div>

    <!-- 我的客户列表 -->
    <div id="customerList" class="friends-content scroll" @scroll="handlerScroll">
      <!-- 会话|通讯录|群聊|搜索结果 -->
      <div
        class="friend-info"
        :class="{ selected: message.RemoteId === currentFriendId }"
        v-for="(message, index) in currentInfo"
        :key="index"
        @click="choseCustomer(message)"
      >
        <!-- 头像 -->
        <el-avatar shape="square" :size="36" :src="message.Avatar">
          <i class="fa fa-picture-o" aria-hidden="true" title="头像miss"></i>
        </el-avatar>

        <!-- 昵称和后缀 -->
        <div class="friend-nick">
          <span v-text="message.Alias || message.Name"></span>
          <span v-if="nickSuffix(message)" style="color: #67c23a">&nbsp;@{{ nickSuffix(message) }}</span>
        </div>

        <!-- 获取详情 -->
        <div class="opration-btns">
          <i class="fa fa-retweet sigle-fresh" aria-hidden="true" @click.stop="$parent.getFriendDetail(message)"></i>
        </div>
      </div>
    </div>

    <div class="friends-bottom">
      共 {{ currentCustomers.length }} 人
      <el-button link icon="el-icon-refresh" :loading="syncing" @click="refreshCustomer">
        {{ syncing ? '同步中…' : '刷新' }}
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { TriggerCustomerPushTask } from '@/api/webSocketApi'
import { fetchContactSyncStatus } from '@/api/httpApi'
import { weComNickSuffix } from '@/utils/wechat'

// 同步状态轮询：2s 一次，最多 15 次（30s）
const SYNC_POLL_INTERVAL = 2000
const SYNC_POLL_MAX_TRIES = 15

export default {
  data() {
    return {
      searchInfo: '', // 搜索内容
      maxNumber: 20,
      syncing: false, // 同步进行中（按钮 loading）
      syncTimer: null,
      syncTries: 0
    }
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId', // 当前选择的微信
      currentCustomers: 'conversation/currentCustomers', // 当前的客户
      contactsMap: 'conversation/contactsMap',
      currentFriendId: 'conversation/currentFriendId' // 当前微信选的好友
    }),
    // 当前的信息
    currentInfo() {
      if (this.searchInfo) {
        const q = this.searchInfo
        return this.currentCustomers.filter((x) => {
          const name = x.Name || ''
          const alias = x.Alias || ''
          return name.indexOf(q) >= 0 || alias.indexOf(q) >= 0
        })
      }
      return this.currentCustomers.slice(0, this.maxNumber)
    }
  },
  beforeUnmount() {
    this.stopSyncPolling()
  },
  methods: {
    nickSuffix(message) {
      return weComNickSuffix(message, this.contactsMap)
    },
    // 刷新数据：下发 Trigger 后轮询同步状态，完成/失败给出提示（旧数据保持可见）
    refreshCustomer() {
      if (!this.currentWeChatId) {
        this.$message({
          message: '请先选中微信',
          type: 'warning'
        })
        return
      }
      if (this.syncing) return
      const sent = TriggerCustomerPushTask(this.currentWeChatId)
      if (sent === false) {
        this.$message({ message: 'WebSocket 未连接，请稍后重试', type: 'error' })
        return
      }
      this.syncing = true
      this.startSyncPolling('customer', 'SetCurrentCustomers')
    },
    // 轮询 /pc/GetContactSyncStatus 直到 SUCCESS/FAILED/超时
    startSyncPolling(type, reloadAction) {
      const wxId = this.currentWeChatId
      this.syncTries = 0
      this.syncTimer = setInterval(async () => {
        this.syncTries += 1
        if (this.syncTries > SYNC_POLL_MAX_TRIES) {
          this.stopSyncPolling()
          this.$message({ message: '同步超时，请稍后重试', type: 'warning' })
          return
        }
        try {
          const res = await fetchContactSyncStatus(wxId, type)
          const st = res && res.code === 0 ? res.data : null
          if (!st) return
          if (st.state === 'SUCCESS') {
            this.stopSyncPolling()
            this.$message({ message: '同步完成', type: 'success' })
            this.$store.dispatch(`conversation/${reloadAction}`, wxId)
          } else if (st.state === 'FAILED') {
            this.stopSyncPolling()
            this.$message({ message: st.errorMsg || '同步失败', type: 'error' })
          }
        } catch (e) {
          // 单次轮询失败不中断，等下一轮
        }
      }, SYNC_POLL_INTERVAL)
    },
    stopSyncPolling() {
      this.syncing = false
      if (this.syncTimer) {
        clearInterval(this.syncTimer)
        this.syncTimer = null
      }
    },
    // 选择好友或会话
    choseCustomer(message) {
      let currentContact = {
        wxid: this.currentWeChatId,
        contact: { ...message }
      }
      // 设置coversation页面所选的好友
      this.$store.commit('conversation/SET_CURRENT_FRIENDS', currentContact)
    },
    // 滚动加载
    handlerScroll() {
      const st = document.getElementById('customerList').scrollTop
      const ch = document.getElementById('customerList').clientHeight
      const sh = document.getElementById('customerList').scrollHeight
      if (st + ch + 2 >= sh) {
        if (this.maxNumber <= this.currentCustomers.length) {
          this.maxNumber = this.maxNumber + 5
        }
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.customer-list {
  width: 270px;
  min-width: 270px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-right: solid $border-color-base 2px;

  .search-box {
    padding: 5px;
    background-color: $bg-color-content-base;
  }

  .friends-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    overflow-y: scroll;
    background-color: $bg-color-content-base;
    // margin-bottom: 5px;

    .friend-info {
      width: 100%;
      height: 50px;
      min-height: 50px;
      overflow: hidden;
      cursor: pointer;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .friend-nick {
        width: 170px;
        // width: calc(100% -80px);
        line-height: 20px;
        @include ellipsis(2);
      }

      .opration-btns {
        display: flex;
        justify-content: space-around;
        width: 40px;
      }

      &:hover {
        background-color: #dedcdb;
      }
    }

    .selected {
      background-color: #c8c6c6;
      &:hover {
        background-color: #c8c6c6;
      }
    }
  }

  .friends-bottom {
    height: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-around;
    border-top: solid $border-color-base 2px;
  }
}
</style>
