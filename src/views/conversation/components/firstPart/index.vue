<template>
  <div class="first-part">
    <!-- tab -->
    <div class="friends-title">
      <span
        class="tab can-not-select"
        :class="{ 'tab-chose': currentTab === 'ConversationList' }"
        @click="toggleCurrentTab('ConversationList')"
      >
        会话
      </span>
      <span
        class="tab can-not-select"
        :class="{ 'tab-chose': currentTab === 'CustomerList' }"
        @click="toggleCurrentTab('CustomerList')"
      >
        我的客户
      </span>
      <span
        class="tab can-not-select"
        :class="{ 'tab-chose': currentTab === 'StaffList' }"
        @click="toggleCurrentTab('StaffList')"
      >
        企业通讯录
      </span>
    </div>
    <ConversationList v-if="currentTab === 'ConversationList'" />
    <CustomerList v-else-if="currentTab === 'CustomerList'" />
    <StaffList v-else />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { defineAsyncComponent } from 'vue'

// Vue3 异步组件必须用 defineAsyncComponent 包裹，否则直接渲染成 [object Promise]
const ConversationList = defineAsyncComponent(() => import('./ConversationList.vue'))
const CustomerList = defineAsyncComponent(() => import('./CustomerList.vue'))
const StaffList = defineAsyncComponent(() => import('./StaffList.vue'))

import { GetContactInfoTask } from '@/api/webSocketApi'

export default {
  name: 'FirstPart',
  data() {
    return {
      currentTab: 'ConversationList'
    }
  },
  components: {
    ConversationList,
    CustomerList,
    StaffList
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId' // 当前选择的微信
    })
  },
  watch: {
    currentWeChatId() {
      this.toggleCurrentTab('ConversationList')
    }
  },
  methods: {
    // 切换tab
    toggleCurrentTab(tab) {
      this.currentTab = tab
    },
    // 获取好友信息
    getFriendDetail(message) {
      GetContactInfoTask(message.WxId, message.RemoteId)
    }
  }
}
</script>

<style lang="scss" scoped>
.first-part {
  width: 270px;
  min-width: 270px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-right: solid $border-color-base 2px;

  .friends-title {
    height: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-around;
    border-bottom: solid $border-color-1 1px;
    background: #fff;

    .tab {
      width: 90px;
      height: 40px;
      line-height: 40px;
      text-align: center;
      cursor: pointer;
      color: $font-color-1;
      position: relative;
      transition: color 0.15s;
      &:hover {
        color: $accent-conv;
      }
    }
    .tab-chose {
      color: $accent-conv;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.08);
      &::after {
        content: '';
        position: absolute;
        left: 20%;
        right: 20%;
        bottom: 0;
        height: 2px;
        background: $accent-conv;
        border-radius: 1px;
      }
    }
  }
}
</style>
