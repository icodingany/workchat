<template>
  <div class="conversation-tools mobile-manager" :style="{ height: manHeight }">
    <van-nav-bar
      title="聊天工具"
      left-text="关闭"
      left-arrow
      @click-left="closePop"
    />
    <div class="content scroll" :style="{ height: conHeight }">
      <component v-if="currentPage" :is="currentPage" @closePop="closePop" />
    </div>
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import bus from '@/utils/bus'
import { mapGetters } from 'vuex'

const FastReply = defineAsyncComponent(() => import('@/views/conversation/components/thirdPart/FastReply.vue'))
const PersonalReply = defineAsyncComponent(() => import('@/views/conversation/components/thirdPart/PersonalReply.vue'))
const FriendInfo = defineAsyncComponent(() => import('@/views/conversation/components/thirdPart/FriendInfo.vue'))
const ChatRoomManager = defineAsyncComponent(() => import('@/views/conversation/components/thirdPart/RoomInfo.vue'))

export default {
  name: 'MobileManager',
  components: {
    FastReply,
    PersonalReply,
    FriendInfo,
    ChatRoomManager
  },
  data() {
    return {
      currentPage: 'PersonalReply',
      manHeight: '100%',
      conHeight: '100%'
    }
  },
  computed: {
    ...mapGetters('conversation', {
      currentWeChatId: 'currentWeChatId',
      currentFriendId: 'currentFriendId'
    })
  },
  watch: {
    currentWeChatId() {
      this.resetPage()
    },
    currentFriendId() {
      this.resetPage()
    }
  },
  mounted() {
    this.setViewportHeight()
    window.addEventListener('resize', this.setViewportHeight)
    this.resetPage()
    this._onToggleAsideRightPage = (page) => {
      this.setCurrentPage(page)
    }
    bus.$on('toggleAsideRightPage', this._onToggleAsideRightPage)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.setViewportHeight)
    bus.$off('toggleAsideRightPage', this._onToggleAsideRightPage)
  },
  methods: {
    setViewportHeight() {
      this.manHeight = window.innerHeight + 'px'
      this.conHeight = window.innerHeight - 46 + 'px'
    },
    closePop() {
      this.$emit('closePop')
    },
    setCurrentPage(pageName) {
      if (pageName === 'InfoManager' || pageName === 'ChatRoomManager') {
        this.currentPage =
          this.currentFriendId && String(this.currentFriendId).indexOf('chatroom') > 0
            ? 'ChatRoomManager'
            : 'FriendInfo'
        return
      }
      const map = {
        FastReply: 'FastReply',
        PersonalReply: 'PersonalReply',
        FriendInfo: 'FriendInfo',
        ChatRoomManager: 'ChatRoomManager'
      }
      this.currentPage = map[pageName] || pageName || 'PersonalReply'
    },
    resetPage() {
      this.currentPage = 'PersonalReply'
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-manager {
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
  overflow: hidden;

  .content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
