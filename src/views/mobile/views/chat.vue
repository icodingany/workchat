<template>
  <div class="mobile-chat mobile-chat-shell" :style="{ height: chatHeight }">
    <van-nav-bar left-text="返回" left-arrow @click-left="onClickLeft">
      <template #title>
        <div class="chats-title-mobile" @click="showInfoManager">
          <span class="nick-name">{{ friendDisplayName }}</span>
          <span v-if="memberCount" class="members-number">({{ memberCount }})</span>
        </div>
      </template>
      <template #right>
        <van-icon name="ellipsis" size="20" @click="showManager" />
      </template>
    </van-nav-bar>

    <div class="mobile-chats-content">
      <ShowChats />
      <div class="input-window">
        <ToolsBar />
        <AnswerWindow ref="answerWindow" />
      </div>
    </div>

    <van-popup
      v-model:show="showManagerPop"
      position="right"
      :style="{ width: '88%', height: '100%' }"
      teleport="body"
    >
      <manager @closePop="closePop" />
    </van-popup>
  </div>
</template>

<script>
import '@/styles/mobile-conversation-chats.scss'
import { mapGetters } from 'vuex'
import bus from '@/utils/bus'
import ShowChats from '@/views/conversation/components/secondPart/ShowChats.vue'
import ToolsBar from '@/views/conversation/components/secondPart/ToolsBar.vue'
import AnswerWindow from '@/views/conversation/components/secondPart/AnswerWindow.vue'
import manager from './manager.vue'

export default {
  name: 'MobileChat',
  components: { ShowChats, ToolsBar, AnswerWindow, manager },
  data() {
    return {
      chatHeight: '100%',
      showManagerPop: false
    }
  },
  computed: {
    ...mapGetters('conversation', {
      currentFriend: 'currentFriend',
      currentWeChatId: 'currentWeChatId',
      currentFriendId: 'currentFriendId'
    }),
    friendDisplayName() {
      const f = this.currentFriend || {}
      return f.Alias || f.Name || f.ShowName || f.NickName || f.Remark || f.RemoteId || '聊天'
    },
    memberCount() {
      const members = this.currentFriend && this.currentFriend.Members
      return members && members.length ? members.length : 0
    }
  },
  mounted() {
    this.setViewportHeight()
    window.addEventListener('resize', this.setViewportHeight)
    this.ensureSessionFromRoute()
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.setViewportHeight)
  },
  watch: {
    '$route.query.convId': {
      handler() {
        this.ensureSessionFromRoute()
      }
    }
  },
  methods: {
    setViewportHeight() {
      this.chatHeight = window.innerHeight + 'px'
    },
    ensureSessionFromRoute() {
      const convId = this.$route && this.$route.query && this.$route.query.convId
      const wxId = (this.$route && this.$route.query && this.$route.query.wxId) || this.currentWeChatId
      if (!convId || !wxId) return
      if (this.currentFriendId === convId && this.currentWeChatId === wxId) return
      this.$store.commit('conversation/SET_CURRENT_FRIENDS', {
        wxid: wxId,
        contact: { RemoteId: convId, WxId: wxId, WeChatId: wxId }
      })
    },
    onClickLeft() {
      this.$emit('toPage', 'index')
      if (this.$route.path === '/chat') {
        this.$router.replace('/conversation')
      }
    },
    closePop() {
      this.showManagerPop = false
    },
    showManager() {
      this.showManagerPop = true
      this.$nextTick(() => {
        bus.$emit('toggleAsideRightPage', 'PersonalReply')
      })
    },
    showInfoManager() {
      this.showManagerPop = true
      this.$nextTick(() => {
        const page =
          this.currentFriendId && String(this.currentFriendId).indexOf('chatroom') > 0
            ? 'ChatRoomManager'
            : 'FriendInfo'
        bus.$emit('toggleAsideRightPage', page)
      })
    }
  }
}
</script>
