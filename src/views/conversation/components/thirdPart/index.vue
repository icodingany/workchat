<template>
  <div class="conversation-tools">
    <!-- tab切换 -->
    <div class="tools-title">
      <span class="tab can-not-select" :class="{ 'tab-chose': currentTab === 'replies' }" @click="setTab('replies')">
        公共话术
      </span>
      <span
        class="tab can-not-select"
        :class="{ 'tab-chose': currentTab === 'personal' }"
        @click="setTab('personal')"
      >
        个人话术
      </span>
      <span
        v-if="currentFriend.Members"
        class="tab can-not-select"
        :class="{ 'tab-chose': currentTab === 'roomInfo' }"
        @click="setTab('roomInfo')"
      >
        群管理
      </span>
      <span
        v-else
        class="tab can-not-select"
        :class="{ 'tab-chose': currentTab === 'friendInfo' }"
        @click="setTab('friendInfo')"
      >
        好友信息
      </span>
    </div>

    <!-- tab 显示 -->
    <div class="tools-content">
      <FastReply v-if="currentTab === 'replies'" />
      <PersonalReply v-if="currentTab === 'personal'" />
      <FriendInfo v-if="currentTab === 'friendInfo'" />
      <RoomInfo v-if="currentTab === 'roomInfo'" />
    </div>
  </div>
</template>



<script>
import { mapGetters } from 'vuex'
import FastReply from './FastReply.vue'
import PersonalReply from './PersonalReply.vue'
import RoomInfo from './RoomInfo.vue'
import FriendInfo from './FriendInfo.vue'

import { TriggerUserLabelTask } from '@/api/webSocketApi'

export default {
  data() {
    return {
      loading: false,
      currentTab: 'replies'
    }
  },
  components: {
    FastReply,
    PersonalReply,
    FriendInfo,
    RoomInfo
  },
  computed: {
    ...mapGetters({
      currentFriend: 'conversation/currentFriend',
      currentFriendId: 'conversation/currentFriendId',
      currentWeChatId: 'conversation/currentWeChatId'
    })
  },
  watch: {
    currentFriendId() {
      this.currentTab = 'replies'
    }
  },
  methods: {
    setTab(tab) {
      this.currentTab = tab
      if (tab === 'friendInfo') {
        TriggerUserLabelTask(this.currentWeChatId)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.conversation-tools {
  width: 300px;
  min-width: 300px;
  //   margin-right: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  .tools-title {
    height: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-around;
    border-bottom: solid $border-color-1 1px;
    background: #fff;

    .tab {
      flex: 1;
      min-width: 0;
      height: 40px;
      line-height: 40px;
      text-align: center;
      cursor: pointer;
      color: $font-color-1;
      position: relative;
      transition: color 0.15s;
      font-size: 12px;
      padding: 0 2px;
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

  .tools-content {
    padding: 5px;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #f4f4f5;
    background-color: $bg-color-content-base;
  }
}
</style>
