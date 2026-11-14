<template>
  <div class="conversation-chats">
    <!-- 好友信息 -->
    <div class="chats-title">
      <!-- 头像 -->
      <div v-if="friendAvatarList.length" class="avatar avatars">
        <img
          :class="'avatar' + '-' + friendAvatarList.length"
          v-for="(avatar, index) in friendAvatarList"
          :key="index"
          :src="avatar"
          alt
        />
      </div>
      <img v-else-if="friendAvatarUrl" class="avatar" :src="friendAvatarUrl" alt="头像" />
      <img v-else-if="isGroupChat" class="avatar" :src="wechatGroupAvatar" alt="群聊" />
      <img v-else class="avatar" src="../../../../assets/svg/conversation-image-error.svg" alt="头像" />
      <!-- 昵称 -->
      <span class="nick-name ellipsis" v-text="currentFriend.Name"></span>
      <!-- 群人数 -->
      <div
        class="members-number"
        v-if="currentFriend.Members"
        v-text="' ( ' + currentFriend.Members.length + ' ) '"
      ></div>
      <!-- 性别 -->
      <div v-if="currentFriend.Gender" class="gender" v-text="currentFriend.Gender"></div>
      <!-- 职务 -->
      <div v-if="currentFriend.Job" class="gender" v-text="currentFriend.Job"></div>
      <button
        type="button"
        class="sync-msg-btn"
        title="从手机同步本会话消息"
        @click="onSyncMessages"
      >
        同步消息
      </button>
    </div>

    <!-- 输入/输出 -->
    <div class="chats-content">
      <!-- 会话切换由 ShowChats watch + VirtualChatList :session-key 处理；
           勿对 ShowChats 整树 :key 重建（会拆掉 OpenSession 防抖并加重主线程，易拖垮 WS） -->
      <ShowChats />
      <div class="input-window">
        <ToolsBar />
        <AnswerWindow ref="answerWindow" />
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { getConversationAvatarList, resolveConversationAvatarUrl } from '@/utils/wechat'
import { isGroupConversation } from '@/utils/conversationSort'
import wechatGroupAvatar from '@/assets/images/wechatGroup.png'
import ToolsBar from './ToolsBar'
import AnswerWindow from './AnswerWindow'
import ShowChats from './ShowChats'
import bus from '@/utils/bus'

export default {
  data() {
    return {
      wechatGroupAvatar
    }
  },
  components: {
    ToolsBar,
    AnswerWindow,
    ShowChats
  },
  computed: {
    ...mapGetters({
      currentFriend: 'conversation/currentFriend'
    }),
    friendAvatarList() {
      return getConversationAvatarList(this.currentFriend)
    },
    friendAvatarUrl() {
      return resolveConversationAvatarUrl(this.currentFriend)
    },
    isGroupChat() {
      return isGroupConversation(this.currentFriend)
    }
  },
  methods: {
    onSyncMessages() {
      if (!this.currentFriend || !(this.currentFriend.RemoteId || this.currentFriend.Id)) {
        this.$message.warning('请先打开会话')
        return
      }
      bus.emit('manualSyncHistory')
    }
  }
}
</script>

<style lang="scss" scoped>
.conversation-chats {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-right: solid $border-color-base 2px;

  .chats-title {
    height: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    border-bottom: solid $border-color-base 2px;

    .avatar {
      width: 30px;
      height: 30px;
      margin-left: 5px;
      object-fit: cover;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .avatars {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-evenly;
      background: $brand-color-9;
      width: 30px;
      height: 30px;
      border-radius: 4px;
      overflow: hidden;
      img {
        object-fit: cover;
        display: block;
      }
      .avatar-1 {
        width: 100%;
        height: 100%;
      }
      .avatar-2,
      .avatar-3 {
        width: 45%;
        height: 45%;
      }
      .avatar-4,
      .avatar-5,
      .avatar-6,
      .avatar-7,
      .avatar-8,
      .avatar-9 {
        width: 30%;
        height: 30%;
      }
    }
    .nick-name,
    .gender,
    .address,
    .members-number {
      font-size: 14px;
      margin-left: 10px;
      //   color: white;
    }
    .nick-name {
      max-width: 250px;
    }
    .sync-msg-btn {
      margin-left: auto;
      margin-right: 12px;
      padding: 2px 10px;
      font-size: 12px;
      line-height: 22px;
      color: $brand-color-base;
      background: transparent;
      border: 1px solid $border-color-base;
      border-radius: 4px;
      cursor: pointer;
      flex-shrink: 0;
      &:hover {
        border-color: $brand-color-base;
        background: $brand-color-9;
      }
    }
  }

  .chats-content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: $bg-color-content-base;

    /* 对齐 kelailaichatpc：生产 CSS 分包后保证消息区有非零高度，否则 DynamicScroller 空白 */
    :deep(.show-chats-wrapper) {
      flex: 1 1 0;
      min-height: 0;
      height: auto;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    :deep(.virtual-chat-list-host),
    :deep(#show-chat.show-chats),
    :deep(.show-chats.scroll) {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      width: 100%;
    }

    .input-window {
      height: 35%;
      min-height: 120px;
      flex-shrink: 0;
      background: white;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
  }
}
</style>

