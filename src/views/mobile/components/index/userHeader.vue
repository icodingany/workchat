<template>
  <div class="user-header">
    <div class="header">
      <van-popover v-model:show="showPopover" :actions="actions" @select="onSelect" placement="bottom-start">
        <template #reference>
          <div class="user-box">
            <span class="user-avatar">{{ displayInitial }}</span>
            <span class="nick-name">{{ displayName }}</span>
            <van-icon name="arrow-down" size="10" color="#483E2D" />
          </div>
        </template>
      </van-popover>

      <van-dropdown-menu active-color="#07c160">
        <van-dropdown-item ref="settingsItem">
          <template #title>
            <van-icon name="setting-o" style="margin-right: 4px" />
            <span>设置</span>
          </template>
          <van-cell center title="更多功能">
            <template #right-icon>
              <van-button size="small" type="primary" plain round @click="openMore">打开</van-button>
            </template>
          </van-cell>
        </van-dropdown-item>
      </van-dropdown-menu>

      <AppModeSwitch theme="dark" class="header-mode-switch" />
    </div>

    <van-action-sheet
      v-model:show="showMore"
      :actions="featureActions"
      cancel-text="取消"
      close-on-click-action
      @select="onFeatureSelect"
    />
  </div>
</template>

<script>
import { mapState } from 'vuex'
import AppModeSwitch from '@/components/AppModeSwitch.vue'

export default {
  name: 'MobileUserHeader',
  components: { AppModeSwitch },
  data() {
    return {
      showPopover: false,
      showMore: false,
      actions: [
        { text: '管理端', value: 'admin' },
        { text: '退出登录', value: 'logout', color: '#ee0a24' }
      ],
      featureActions: [
        { name: '朋友圈', path: '/friend-circle' },
        { name: '群发助手', path: '/group-assistant' },
        { name: '加好友', path: '/add-friend' },
        { name: '功能大全', path: '/tools' }
      ]
    }
  },
  computed: {
    ...mapState({
      currentUser: 'currentUser',
      adminInfo: 'adminInfo'
    }),
    displayName() {
      return this.currentUser?.NickName || this.currentUser?.UserName || this.adminInfo?.name || '用户'
    },
    displayInitial() {
      return (this.displayName || '?').charAt(0).toUpperCase()
    }
  },
  methods: {
    openMore() {
      this.showMore = true
      if (this.$refs.settingsItem) {
        this.$refs.settingsItem.toggle(false)
      }
    },
    onSelect(action) {
      if (action.value === 'admin') {
        this.$router.push('/admin')
        return
      }
      if (action.value === 'logout') {
        this.handleLogout()
      }
    },
    onFeatureSelect(action) {
      if (action && action.path) {
        this.$router.push(action.path)
      }
    },
    handleLogout() {
      this.$store.dispatch('websocket/AccountLogoutNotice').catch(() => {})
      this.$store.commit('SET_ADMIN_INO', null)
      this.$store.commit('SET_HTTP_TOKEN', '')
      localStorage.removeItem('httpToken')
      this.$store.commit('SET_WEBSOCKET_TOKEN', '')
      try {
        sessionStorage.removeItem('sessionNameOfJuboChat')
        sessionStorage.removeItem('sessionPwdOfJuboChat')
      } catch (e) {}
      this.$router.push('/login')
    }
  }
}
</script>

<style lang="scss" scoped>
.user-header {
  background: linear-gradient(135deg, #07c160, #06ad56);
  padding: 10px 12px 8px;
  flex-shrink: 0;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .user-box {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
    cursor: pointer;

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .nick-name {
      font-size: 15px;
      font-weight: 500;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  :deep(.van-dropdown-menu__bar) {
    background: transparent;
    box-shadow: none;
    height: 36px;
  }

  :deep(.van-dropdown-menu__title) {
    color: #fff;
    font-size: 14px;
  }

  :deep(.van-dropdown-menu__title::after) {
    border-color: transparent transparent #fff #fff;
  }

  .header-mode-switch {
    flex-shrink: 0;

    :deep(.app-mode-switch) {
      margin-right: 0;
    }
  }
}
</style>
