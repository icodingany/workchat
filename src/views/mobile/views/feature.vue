<template>
  <div class="mobile-feature-page">
    <header class="feature-header">
      <button class="back-button" type="button" @click="goBack">返回</button>
      <h1>{{ title }}</h1>
      <button v-if="showHome" class="home-button" type="button" @click="$router.push('/conversation')">聊天</button>
      <span v-else class="header-spacer"></span>
    </header>
    <main class="feature-content">
      <component :is="featureComponent" v-if="featureComponent" />
    </main>
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue'

const features = {
  friendCircle: defineAsyncComponent(() => import('@/views/friendCircle/index.vue')),
  groupAssistant: defineAsyncComponent(() => import('@/views/groupSend/index.vue')),
  addFriend: defineAsyncComponent(() => import('@/views/addFriend/index.vue')),
  tools: defineAsyncComponent(() => import('@/views/tools/index.vue')),
  accountManagement: defineAsyncComponent(() => import('@/views/admin/components/AccountManagement.vue')),
  phonesManagement: defineAsyncComponent(() => import('@/views/admin/components/PhonesManagement.vue')),
  customerManagement: defineAsyncComponent(() => import('@/views/admin/components/SuperCustomerManagement.vue')),
  phonesManagementSuper: defineAsyncComponent(() => import('@/views/admin/components/SuperPhonesManagement.vue')),
  regCodeManagement: defineAsyncComponent(() => import('@/views/admin/components/RegCodeManagement.vue')),
  commonReplies: defineAsyncComponent(() => import('@/views/admin/components/CommonReplies.vue')),
  commonTags: defineAsyncComponent(() => import('@/views/admin/components/CommonTags.vue')),
  friendList: defineAsyncComponent(() => import('@/views/admin/components/FriendList.vue')),
  chatRoomList: defineAsyncComponent(() => import('@/views/admin/components/ChatRoomList.vue')),
  newFriendAutoReply: defineAsyncComponent(() => import('@/views/admin/components/NewFriendAutoReply.vue')),
  scheduledMassMessage: defineAsyncComponent(() => import('@/views/admin/components/ScheduledMassMessage.vue')),
  scheduledMoments: defineAsyncComponent(() => import('@/views/admin/components/ScheduledMoments.vue')),
  materialLibrary: defineAsyncComponent(() => import('@/views/tools/components/MaterialLibrary.vue'))
}

export default {
  name: 'MobileFeature',
  computed: {
    featureKey() {
      return this.$route.meta.featureKey
    },
    featureComponent() {
      return features[this.featureKey]
    },
    title() {
      return this.$route.meta.title || '功能'
    },
    showHome() {
      return !this.$route.meta.adminFeature
    }
  },
  methods: {
    goBack() {
      if (this.$route.meta.adminFeature) {
        this.$router.push('/admin')
        return
      }
      this.$router.push('/conversation')
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-feature-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f7f8fa;
  overflow: hidden;
}

.feature-header {
  align-items: center;
  background: linear-gradient(135deg, #0f766e, #15803d);
  color: #fff;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  justify-content: space-between;
  min-height: 52px;
  padding: env(safe-area-inset-top) 12px 0;
  position: relative;
  z-index: 10;

  h1 {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
    line-height: 52px;
    margin: 0;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button,
  .header-spacer {
    background: transparent;
    border: 0;
    color: inherit;
    font-size: 14px;
    min-width: 48px;
    padding: 8px 4px;
    -webkit-tap-highlight-color: transparent;
  }

  .home-button {
    text-align: right;
  }
}

.feature-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 8px;
  -webkit-overflow-scrolling: touch;

  :deep(.el-table) {
    min-width: 640px;
  }
}
</style>
