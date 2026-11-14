<template>
  <el-aside class="aside-page mobile-aside" width="72px" :style="asideStyle">
    <div class="wechats-state">
      <i class="fa fa-weixin" aria-hidden="true"></i>
      <span>{{ wechatsOnline.length }}/{{ wechats.length }}</span>
    </div>

    <ul class="wechats-list scroll">
      <li class="all-accounts-option" :class="{ active: allConvsActive }" @click="enterAllConvs">
        <el-icon><User /></el-icon>
        <span>全部</span>
      </li>

      <li
        v-for="item in wechats"
        :key="wxId(item)"
        class="wechat-item"
        :class="{
          'wechat-chose': sameWxId(currentWeChatId, wxId(item)),
          'item-disabled': !isWechatOnline(item)
        }"
        :title="displayName(item)"
        @click="selectWechat(item)"
      >
        <div class="avatar-messages">
          <img class="wechat-avatar" :src="item.Avatar || avatarFallback" alt="" />
          <span v-if="unreadCount(item)" class="new-message-notice">{{ unreadCount(item) }}</span>
          <span v-if="!isWechatOnline(item)" class="offline-mark">离</span>
        </div>
        <p class="wechat-nick ellipsis">{{ displayName(item) }}</p>
      </li>

      <li v-if="wechats.length === 0" class="empty-tip">暂无</li>
    </ul>
  </el-aside>
</template>

<script>
import { User } from '@element-plus/icons-vue'
import { mapGetters, mapState } from 'vuex'
import { normalizeWxId, sameWxId, wechatDisplayName, isWechatOnline } from '@/utils/wechat'
import avatarFallback from '@/assets/svg/conversation-image-error.svg'

export default {
  name: 'MobileAsideList',
  components: { User },
  props: {
    mainHeight: {
      type: String,
      default: ''
    },
    allConvsActive: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      avatarFallback,
      localHeight: '100%'
    }
  },
  computed: {
    ...mapState('conversation', {
      wechats: 'wechats'
    }),
    ...mapGetters('conversation', {
      currentWeChatId: 'currentWeChatId',
      messagesNotRead: 'messagesNotRead',
      wechatsOnline: 'wechatsOnline'
    }),
    ...mapGetters({
      showDevNick: 'showDevNick'
    }),
    asideStyle() {
      const h = this.mainHeight || this.localHeight
      return { height: h, minHeight: h }
    }
  },
  mounted() {
    this.syncHeight()
    window.addEventListener('resize', this.syncHeight)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.syncHeight)
  },
  methods: {
    sameWxId,
    isWechatOnline,
    syncHeight() {
      if (this.mainHeight) return
      this.localHeight = `${Math.max(window.innerHeight - 100, 320)}px`
    },
    wxId(item) {
      return normalizeWxId(item?.WxId || item?.WeChatId || item?.wxId)
    },
    unreadCount(item) {
      const id = this.wxId(item)
      if (!id) return 0
      const map = this.messagesNotRead || {}
      return Number(map[id]) || 0
    },
    displayName(item) {
      return wechatDisplayName(item, this.showDevNick) || this.wxId(item) || '未命名'
    },
    selectWechat(wechat) {
      const id = this.wxId(wechat)
      if (!id) return
      this.$emit('exit-all-convs')
      this.$store.commit('conversation/SET_CURRENT_WECHAT', wechat)
      // 会话拉取由 index.loadWechatData（currentWeChatId watch）统一处理
      try {
        localStorage.setItem('lastSelectedWeChatId', id)
      } catch (_) {}
    },
    enterAllConvs() {
      this.$emit('enter-all-convs')
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-aside.aside-page {
  flex: 0 0 72px;
  min-width: 72px;
  overflow: hidden;
  border-right: solid #ebedf0 1px;
  background: #fff;
  display: flex;
  flex-direction: column;

  .wechats-state {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 36px;
    font-size: 11px;
    color: #646566;
    border-bottom: 1px solid #ebedf0;

    .fa-weixin {
      color: #07c160;
      font-size: 14px;
    }
  }

  .wechats-list {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    margin: 0;
    padding: 4px 0 8px;
    list-style: none;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;

    .all-accounts-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 4px;
      font-size: 11px;
      color: #646566;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &.active,
      &:active {
        background: rgba(7, 193, 96, 0.1);
        color: #07c160;
      }
    }

    .wechat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &:active,
      &.wechat-chose {
        background: rgba(7, 193, 96, 0.12);
      }

      &.item-disabled .wechat-avatar {
        filter: grayscale(1);
        opacity: 0.65;
      }

      .avatar-messages {
        position: relative;
        width: 28px;
        height: 28px;

        .wechat-avatar {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          object-fit: cover;
          display: block;
        }

        .new-message-notice {
          position: absolute;
          top: -4px;
          right: -6px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          line-height: 16px;
          text-align: center;
          font-size: 10px;
          color: #fff;
          background: #f56c6c;
          border-radius: 8px;
        }

        .offline-mark {
          position: absolute;
          left: -2px;
          top: -2px;
          font-size: 9px;
          color: #fff;
          background: #969799;
          border-radius: 2px;
          padding: 0 2px;
          line-height: 12px;
        }
      }

      .wechat-nick {
        margin: 4px 0 0;
        width: 64px;
        font-size: 11px;
        line-height: 1.2;
        text-align: center;
        color: #323233;
      }
    }

    .empty-tip {
      padding: 12px 4px;
      text-align: center;
      font-size: 11px;
      color: #969799;
    }
  }
}
</style>
