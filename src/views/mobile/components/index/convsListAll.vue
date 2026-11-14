<template>
  <div class="mobile-convs-all">
    <div class="all-convs-header">
      <van-nav-bar title="全部会话" left-arrow @click-left="exitAllConvs" />
    </div>
    <div class="mobile-convs-toolbar">
      <van-button size="small" round type="primary" plain @click="autoReadAll">一键已读</van-button>
      <van-button
        size="small"
        round
        :type="onlyUnread ? 'warning' : 'default'"
        :plain="!onlyUnread"
        @click="onlyUnread = !onlyUnread"
      >
        {{ onlyUnread ? '显示全部' : '仅未读' }}
      </van-button>
    </div>
  <van-search v-model="searchInfo" placeholder="搜索昵称" shape="round" clearable />
    <div class="all-convs-scroll scroll" @scroll="handlerScroll">
      <div v-if="!displayList.length" class="empty-state">暂无会话</div>
      <div
        v-for="conv in displayList"
        :key="convItemKey(conv)"
        class="conv-item"
        @click="openConv(conv)"
      >
        <el-avatar class="conv-avatar" :size="44" :src="convDisplayAvatar(conv)">
          {{ displayName(conv).charAt(0).toUpperCase() }}
        </el-avatar>
        <div class="conv-info">
          <div class="conv-top">
            <span class="conv-name">{{ displayName(conv) }}</span>
            <span class="conv-time">{{ $filters.transformTime(conv.UpdateTime) }}</span>
          </div>
          <div class="conv-bottom">
            <span class="conv-digest">{{ conv.PinnedDigest || conv.Digest || '...' }}</span>
            <span v-if="showUnread(conv)" class="unread-badge">
              {{ conv.UnreadCnt > 99 ? '99+' : conv.UnreadCnt }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="all-convs-footer">共 {{ filteredList.length }} 个</div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { shouldShowConversationUnreadBadge } from '@/utils/conversationDigest'
import { getConversationAvatarList, resolveConversationAvatarUrl } from '@/utils/wechat'
import { isGroupConversation } from '@/utils/conversationSort'
import wechatGroupAvatar from '@/assets/images/wechatGroup.png'

const REVEAL_STEP = 40

export default {
  name: 'ConvsListAll',
  data() {
    return {
      searchInfo: '',
      onlyUnread: false,
      maxNumber: 40
    }
  },
  computed: {
    ...mapGetters('conversation', {
      allConversations: 'allConversations',
      currentWeChatId: 'currentWeChatId'
    }),
    filteredList() {
      let list = this.allConversations || []
      if (this.onlyUnread) {
        list = list.filter((c) => shouldShowConversationUnreadBadge(c))
      }
      const kw = (this.searchInfo || '').trim()
      if (!kw) return list
      return list.filter((c) => {
        const name = c.Alias || c.Name || c.ShowName || ''
        return name.indexOf(kw) >= 0
      })
    },
    displayList() {
      return this.filteredList.slice(0, this.maxNumber)
    }
  },
  methods: {
    convItemKey(conv) {
      const wx = conv.WeChatId || conv.WxId || ''
      return `${wx}-${conv.RemoteId}`
    },
    displayName(conv) {
      return conv.Alias || conv.Name || conv.ShowName || conv.NickName || conv.RemoteId || ''
    },
    convDisplayAvatar(conv) {
      const grid = getConversationAvatarList(conv)
      if (grid.length) return grid[0]
      const url = resolveConversationAvatarUrl(conv)
      if (url) return url
      if (isGroupConversation(conv)) return wechatGroupAvatar
      return ''
    },
    showUnread(conv) {
      return shouldShowConversationUnreadBadge(conv)
    },
    exitAllConvs() {
      if (this.$parent && typeof this.$parent.exitAllConvs === 'function') {
        this.$parent.exitAllConvs()
      }
    },
    openConv(conv) {
      if (this.$parent && typeof this.$parent.choseFriend === 'function') {
        this.$parent.choseFriend(conv, true)
      }
    },
    autoReadAll() {
      const unreadList = (this.allConversations || []).filter((c) => shouldShowConversationUnreadBadge(c))
      unreadList.forEach((conv) => {
        const wxId = conv.WeChatId || conv.WxId
        if (!wxId) return
        const readMsg = {
          WxId: wxId,
          RemoteId: conv.RemoteId,
          Id: conv.Id
        }
        this.$store.dispatch('conversation/SetConvReaded', readMsg)
        this.$store.dispatch('websocket/TriggerMessageReadTask', readMsg).catch(() => {})
      })
      if (unreadList.length) {
        this.$toast?.success?.('已全部标为已读') || this.$message?.success?.('已全部标为已读')
      }
    },
    handlerScroll(e) {
      const el = e.target
      if (!el) return
      if (el.scrollTop + el.clientHeight + 2 < el.scrollHeight) return
      if (this.maxNumber >= this.filteredList.length) return
      this.maxNumber = Math.min(this.maxNumber + REVEAL_STEP, this.filteredList.length)
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-convs-all {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;

  .all-convs-header {
    flex-shrink: 0;
  }

  .all-convs-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .all-convs-footer {
    flex-shrink: 0;
    padding: 8px 16px;
    font-size: 12px;
    color: #969799;
    border-top: 1px solid #ebedf0;
    text-align: center;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #999;
    font-size: 14px;
  }

  .conv-item {
    display: flex;
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    -webkit-tap-highlight-color: transparent;

    &:active {
      background: #f7f8fa;
    }

    .conv-avatar {
      flex-shrink: 0;
      background: linear-gradient(135deg, #07c160, #06ad56);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }

    .conv-info {
      flex: 1;
      margin-left: 12px;
      overflow: hidden;

      .conv-top,
      .conv-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .conv-top {
        margin-bottom: 4px;
      }

      .conv-name {
        font-size: 16px;
        font-weight: 500;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      .conv-time {
        font-size: 12px;
        color: #999;
        flex-shrink: 0;
        margin-left: 8px;
      }

      .conv-digest {
        font-size: 13px;
        color: #999;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      .unread-badge {
        background: #f56c6c;
        color: #fff;
        font-size: 11px;
        border-radius: 10px;
        padding: 1px 6px;
        min-width: 18px;
        text-align: center;
        flex-shrink: 0;
        margin-left: 6px;
      }
    }
  }
}
</style>
