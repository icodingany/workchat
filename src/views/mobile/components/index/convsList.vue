<template>
  <div class="mobile-convs-wrap">
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
      <van-button size="small" round plain @click="enterAllConvs">全部会话</van-button>
    </div>
    <ConversationList
      class="mobile-conversation-list"
      :mobile-layout="true"
      :only-unread-filter="onlyUnread"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import ConversationList from '@/views/conversation/components/firstPart/ConversationList.vue'
import { shouldShowConversationUnreadBadge } from '@/utils/conversationDigest'
import '@/styles/mobile-conversation-list.scss'

export default {
  name: 'MobileConvsList',
  components: { ConversationList },
  data() {
    return {
      onlyUnread: false
    }
  },
  computed: {
    ...mapGetters('conversation', {
      currentConvs: 'currentConvs',
      currentWeChatId: 'currentWeChatId'
    })
  },
  methods: {
    enterAllConvs() {
      if (this.$parent && typeof this.$parent.enterAllConvs === 'function') {
        this.$parent.enterAllConvs()
      }
    },
    autoReadAll() {
      const wxId = this.currentWeChatId
      if (!wxId) return
      const unreadList = (this.currentConvs || []).filter((c) => shouldShowConversationUnreadBadge(c))
      unreadList.forEach((conv) => {
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
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-convs-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
