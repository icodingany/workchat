<template>
  <el-dialog
    title="好友聊天记录"
    :model-value="visible"
    :close-on-click-modal="false"
    append-to-body
    top="5vh"
    width="60%"
    class="friend-chat-dialog"
    @update:model-value="onDialogVisibleChange"
    @close="handleClose"
    @opened="handleOpened"
  >
    <div class="chat-container">
      <div class="chat-header">
        <el-input
          v-model="keyword"
          clearable
          placeholder="请输入聊天内容"
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button icon="el-icon-search" @click="handleSearch" />
          </template>
        </el-input>
      </div>
      <div class="chat-content">
        <div class="friend-panel">
          <div class="friend-item">
            <img class="friend-avatar" :src="friendAvatar" alt="" />
            <div class="friend-info">
              <div class="friend-name">{{ friendDisplayName }}</div>
              <div class="friend-id">{{ friendRemoteId || '-' }}</div>
            </div>
          </div>
        </div>
        <friend-chat-message-list
          ref="list"
          :messages="messages"
          :wx-id="friendWxId"
          :friend-avatar="friendAvatar"
          :friend-name="friendDisplayName"
          :wechat-avatar="wechatAvatar"
          :loading="loading || pulling"
          :empty-text="emptyText"
          :show-load-earlier="messages.length > 0"
          :has-no-more-earlier="!hasMore"
          @load-earlier="loadEarlier"
        />
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { queryChatHistory, triggerHistoryPull } from '@/api/httpApi'
import { queryDevices } from '@/api/httpApiAdmin'
import { triggerHistoryMsgPushTask } from '@/api/webSocketApi'
import { mapHistoryRowToTalk, sortChatsAsc } from '@/store/modules/conversation'
import { sameWxId } from '@/utils/wechat'
import FriendChatMessageList, { enrichHistoryChat } from './FriendChatMessageList.vue'
import {
  computeHasMore,
  mergeEarlierMessages,
  shouldPhonePull,
  sleepMs,
  phonePullIntervalMs,
  PHONE_PULL_MAX_ROUNDS
} from './friendChatPullHelper'
import fallbackAvatar from '@/assets/images/logo-min.png'

export default {
  name: 'FriendChatDialog',
  components: { FriendChatMessageList },
  props: {
    visible: { type: Boolean, default: false },
    friend: { type: Object, default: null }
  },
  data() {
    return {
      keyword: '',
      messages: [],
      page: 1,
      rows: 20,
      hasMore: false,
      loading: false,
      pulling: false,
      emptyText: '暂无聊天记录',
      wechatAvatar: '',
      openSeq: 0
    }
  },
  computed: {
    friendWxId() {
      return (this.friend && this.friend.wxId) || ''
    },
    friendRemoteId() {
      return (this.friend && this.friend.remoteId) || ''
    },
    friendDisplayName() {
      if (!this.friend) return '-'
      return this.friend.alias || this.friend.name || '-'
    },
    friendAvatar() {
      return (this.friend && this.friend.avatar) || fallbackAvatar
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.openChat()
      } else {
        this.resetState()
      }
    }
  },
  methods: {
    // el-dialog element-plus 用 model-value + update:model-value；关闭时同步 emit 给父组件
    onDialogVisibleChange(val) {
      if (!val) this.$emit('update:visible', false)
    },
    handleClose() {
      this.$emit('update:visible', false)
    },
    handleOpened() {
      this.$nextTick(() => {
        if (this.$refs.list) this.$refs.list.scrollToBottom()
      })
    },
    resetState() {
      this.keyword = ''
      this.messages = []
      this.page = 1
      this.hasMore = false
      this.loading = false
      this.pulling = false
      this.emptyText = '暂无聊天记录'
      this.wechatAvatar = ''
    },
    /**
     * 解析企微号头像：优先 Vuex wechats，其次 device/pageList
     */
    async resolveWechatAvatar() {
      const wxId = this.friendWxId
      if (!wxId) return
      const list =
        (this.$store.state.conversation && this.$store.state.conversation.wechats) || []
      for (let i = 0; i < list.length; i++) {
        const w = list[i]
        if (sameWxId(w.WxId || w.wxId, wxId)) {
          const av = w.Avatar || w.avatar
          if (av) {
            this.wechatAvatar = av
            return
          }
        }
      }
      try {
        const res = await queryDevices(1, 50, '', wxId, '', '')
        const rows = (res && res.code === 0 && res.data && res.data.rows) || []
        const hit =
          rows.find((r) => sameWxId(r.wxid || r.wxId || r.WxId, wxId)) || rows[0]
        const av = hit && (hit.avatar || hit.Avatar || hit.wechatAvatar)
        if (av) this.wechatAvatar = av
      } catch (e) {
        /* 头像兜底用 logo */
      }
    },
    async openChat() {
      const seq = ++this.openSeq
      this.resetState()
      this.resolveWechatAvatar()
      const result = await this.loadPage({ reset: true, seq })
      if (seq !== this.openSeq) return
      if (
        shouldPhonePull({
          page: 1,
          keyword: this.keyword,
          rows: result.rows
        })
      ) {
        await this.runPhonePull(seq)
      }
    },
    async loadPage({ reset, appendEarlier, seq }) {
      if (!this.friendWxId || !this.friendRemoteId) {
        this.emptyText = '缺少企微号或好友 ID'
        return { rows: [], total: 0 }
      }
      this.loading = true
      try {
        const page = appendEarlier ? this.page + 1 : reset ? 1 : this.page
        const res = await queryChatHistory(
          this.friendWxId,
          this.friendRemoteId,
          this.keyword || '',
          page,
          this.rows,
          '',
          ''
        )
        if (seq != null && seq !== this.openSeq) return { rows: [], total: 0 }
        if (!res || res.code !== 0 || !res.data) {
          this.$message.error((res && res.msg) || '加载失败')
          return { rows: [], total: 0 }
        }
        const raw = res.data.rows || []
        const total = Number(res.data.records || 0)
        const mapped = raw
          .map((row) => mapHistoryRowToTalk(row, this.friendWxId, this.friendRemoteId))
          .map(enrichHistoryChat)
        mapped.sort(sortChatsAsc)
        if (appendEarlier) {
          const el = this.$refs.list && this.$refs.list.$refs.scrollBody
          const oldH = el ? el.scrollHeight : 0
          this.messages = mergeEarlierMessages(this.messages, mapped)
          this.page = page
          this.hasMore = computeHasMore(page, this.rows, total)
          this.$nextTick(() => {
            if (this.$refs.list) this.$refs.list.preserveScrollAfterPrepend(oldH)
          })
        } else {
          this.messages = mapped
          this.page = page
          this.hasMore = computeHasMore(page, this.rows, total)
          if (!mapped.length && !this.pulling) {
            this.emptyText = '暂无聊天记录'
          }
          this.$nextTick(() => {
            if (this.$refs.list) this.$refs.list.scrollToBottom()
          })
        }
        return { rows: mapped, total }
      } catch (e) {
        this.$message.error('加载失败')
        return { rows: [], total: 0 }
      } finally {
        this.loading = false
      }
    },
    async handleSearch() {
      const seq = ++this.openSeq
      await this.loadPage({ reset: true, seq })
    },
    async loadEarlier() {
      if (!this.hasMore || this.loading || this.pulling) return
      await this.loadPage({ appendEarlier: true, seq: this.openSeq })
    },
    async runPhonePull(seq) {
      this.pulling = true
      this.emptyText = '正在从手机拉取历史…'
      try {
        const triggered = await this.triggerPull()
        if (seq !== this.openSeq) return
        if (!triggered) {
          this.emptyText = '暂无聊天记录（设备未在线或尚未同步）'
          return
        }
        for (let round = 0; round < PHONE_PULL_MAX_ROUNDS; round++) {
          await sleepMs(phonePullIntervalMs(round))
          if (seq !== this.openSeq) return
          const { rows } = await this.loadPage({ reset: true, seq })
          if (seq !== this.openSeq) return
          if (rows.length) {
            this.emptyText = '暂无聊天记录'
            return
          }
        }
        this.emptyText = '暂无聊天记录（设备未在线或尚未同步）'
      } finally {
        if (seq === this.openSeq) this.pulling = false
      }
    },
    async triggerPull() {
      const wxId = this.friendWxId
      const convId = this.friendRemoteId
      const token = this.$store.state.webSocketToken
      const wsOk = this.$store.state.webSocketState === 1 && token
      if (wsOk) {
        triggerHistoryMsgPushTask(wxId, convId, 0, 0, 0)
        return true
      }
      try {
        const res = await triggerHistoryPull(wxId, convId)
        if (res && res.code === 0) return true
        this.$message.warning((res && res.msg) || '无法触发手机拉取')
        return false
      } catch (e) {
        this.$message.warning('无法触发手机拉取')
        return false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 70vh;
  min-height: 420px;
}
.chat-header {
  margin-bottom: 12px;
}
.chat-content {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
  :deep(.friend-chat-msg-list) {
    flex: 1;
    min-width: 0;
  }
}
.friend-panel {
  width: 200px;
  border-right: 1px solid #ebeef5;
  background: #fafafa;
  padding: 12px;
  box-sizing: border-box;
}
.friend-item {
  display: flex;
  align-items: center;
}
.friend-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  margin-right: 10px;
}
.friend-info {
  min-width: 0;
}
.friend-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.friend-id {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  word-break: break-all;
}
</style>
