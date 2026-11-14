<template>
  <div
    class="chat-item"
    :data-msgid="chat.MsgRemoteId || chat.MsgId || ''"
  >
    <!-- 时间 -->
    <div class="chat-time" v-text="$filters.timeFilter(chat.CreateTime)"></div>
    <!-- 内容 -->
    <div
      class="chat-content"
      :class="{ 'chat-content-send': isSelf, 'is-revoked': !!chat.isPreviousRevoked }"
    >
      <el-checkbox
        v-if="ctx.selectMode"
        class="msg-select-check"
        :model-value="ctx.isMsgSelected(chat)"
        @change="ctx.toggleSelectMsg(chat)"
      ></el-checkbox>
      <img class="img" v-if="showAvatar" :src="ctx.getAvatar(chat)" :alt="'好友头像'" />

      <!-- 群成员名 -->
      <div
        class="member-info"
        v-if="ctx.currentFriend && ctx.currentFriend.Members && !isSelf && showAvatar"
      >
        <span v-text="ctx.getMemberName(chat)"></span>
        <el-button style="margin-left: 10px; color: #909399; padding: 5px" link @click="ctx.atSomebody(chat)">
          @Ta
        </el-button>
      </div>

      <!-- content -->
      <div
        class="content-content"
        :class="[
          { 'triangle-send': isSelf && showAvatar },
          { triangle: showAvatar && !isSelf },
          {
            'chat-room':
              ctx.currentFriend && ctx.currentFriend.Members && !isSelf && showAvatar
          },
          { 'system-info': isSystem },
          { 'stranger-tip': isStrangerTip },
          { 'chat-luckmoney': isRedPacketBubble }
        ]"
        @contextmenu.prevent="ctx.showMsgContextMenu($event, chat)"
      >
        <div
          :class="[bubbleClassList, { 'chat-stranger-tip': isStrangerTip }]"
          v-html="decodedHtml"
          @click="ctx.whatToDo(chat)"
        ></div>
        <div v-if="translationEntry" class="msg-translation">
          <span v-if="translationEntry.loading">翻译中...</span>
          <span v-else-if="translationEntry.error">{{ translationEntry.error }}</span>
          <span v-else>{{ translationEntry.text }}</span>
        </div>
        <div v-if="resourceFetchError" class="msg-resource-fetch-error">
          {{ resourceFetchError }}
        </div>
      </div>

      <!-- 发送结果 -->
      <div
        class="send-state"
        :class="{
          'chat-room':
            ctx.currentFriend && ctx.currentFriend.Members && !isSelf && showAvatar
        }"
      >
        <el-button
          link
          v-if="isSelf && ctx.isSendingSpinner(chat)"
          class="el-icon-loading"
        ></el-button>
        <el-icon
          v-else-if="isSelf && ctx.isSendFailDot(chat)"
          class="send-fail-resend-icon"
          :title="chat.SendFailReason ? `发送失败：${chat.SendFailReason}（点击重新发送）` : '点击重新发送'"
          role="button"
          tabindex="0"
          @click.stop="ctx.resendFailedOutgoingChat(chat)"
          @keydown.enter.prevent="ctx.resendFailedOutgoingChat(chat)"
        ><WarningFilled /></el-icon>
      </div>
    </div>

    <!-- 发送人信息：在 chat-content 外侧（对齐 kelailaichatpc ChatItem） -->
    <div
      v-if="isSelf && senderAccountName && showAvatar"
      class="sender-account-info sender-send"
    >
      <span class="sender-label">发送人:</span>
      <span class="sender-name">{{ senderAccountName }}</span>
      <span v-if="ctx.getSenderNickname(senderAccountName)" class="sender-name">
        ({{ ctx.getSenderNickname(senderAccountName) }})
      </span>
    </div>
  </div>
</template>

<script>
import { WarningFilled } from '@element-plus/icons-vue'

export default {
  name: 'ChatItem',
  components: { WarningFilled },
  props: {
    chat: {
      type: Object,
      default: () => ({})
    },
    index: {
      type: Number,
      default: 0
    },
    ctx: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    isSelf() {
      const ctx = this.ctx
      return ctx && typeof ctx.isSelfMsg === 'function' ? ctx.isSelfMsg(this.chat) : false
    },
    showAvatar() {
      const ctx = this.ctx
      return ctx && typeof ctx.showMsgAvatar === 'function' ? ctx.showMsgAvatar(this.chat) : false
    },
    isSystem() {
      const ctx = this.ctx
      return ctx && typeof ctx.isSystemMsg === 'function' ? ctx.isSystemMsg(this.chat) : false
    },
    isStrangerTip() {
      const ctx = this.ctx
      return ctx && typeof ctx.isStrangerTipChat === 'function' ? ctx.isStrangerTipChat(this.chat) : false
    },
    bubbleClassList() {
      const ctx = this.ctx
      return ctx && typeof ctx.bubbleClasses === 'function' ? ctx.bubbleClasses(this.chat) : ''
    },
    isRedPacketBubble() {
      const list = this.bubbleClassList
      return !!(list && list['chat-luckmoney'])
    },
    senderAccountName() {
      const ctx = this.ctx
      return ctx && typeof ctx.resolvedSenderAccountName === 'function'
        ? ctx.resolvedSenderAccountName(this.chat)
        : ''
    },
    translationEntry() {
      const ctx = this.ctx
      if (!ctx || typeof ctx.translateKey !== 'function') return null
      const key = ctx.translateKey(this.chat)
      if (!key || !ctx.translations) return null
      return ctx.translations[key] || null
    },
    resourceFetchError() {
      const ctx = this.ctx
      return ctx && typeof ctx.chatResourceFetchError === 'function'
        ? ctx.chatResourceFetchError(this.chat)
        : ''
    },
    /** decodeChat 缓存：避免长列表每次 render 重算 v-html */
    decodedHtml() {
      const ctx = this.ctx
      const chat = this.chat || {}
      const map = (ctx && ctx.bigImageMap) || {}
      const mid = chat.MsgId
      const rid = chat.MsgRemoteId
      void chat._originalImageReady
      if (mid != null && mid !== '') void map[mid]
      if (rid != null && rid !== '') void map[rid]
      return ctx && typeof ctx.decodeChat === 'function' ? ctx.decodeChat(chat) : ''
    }
  }
}
</script>

<!-- styles extracted from ShowChats.vue .chat-item block -->
<style lang="scss" scoped>
.chat-item {
  display: flex;
  flex-direction: column;
  margin: 5px;

  .chat-time {
    width: 160px;
    height: 20px;
    font-size: 14px;
    line-height: 20px;
    border-radius: 5px;
    color: white;
    margin: 5px auto;
    align-self: center;
    text-align: center;
    background: #dadada;
  }

  /* 发送人行：挂在 .chat-item 下（气泡外侧），勿放进 .chat-content 横向 flex */
  .sender-account-info {
    display: block;
    box-sizing: border-box;
    margin-top: 4px;
    margin-left: 47px;
    padding: 0 0 6px;
    font-size: 11px;
    color: #999;
    line-height: 20px;
    min-height: 20px;
    overflow: visible;
    text-align: left;

    .sender-label {
      margin-right: 2px;
      color: #bbb;
    }

    .sender-name {
      color: #777;
      font-weight: normal;
    }

    &.sender-send {
      margin-left: 0;
      margin-right: 47px;
      text-align: right;
    }
  }

  .chat-content {
    display: flex;
    position: relative;
    padding-top: 10px;
    font-size: 12px;
    color: $font-color-base;

    &.is-revoked {
      opacity: 0.55;
    }

    .img {
      width: 42px;
      height: 42px;
      margin: 5px 5px 5px 0;
      // margin: 5px;
      font-size: 14px;
    }

    .member-info {
      max-width: 60%;
      position: absolute;
      color: $font-color-2;
      top: 0;
      left: 58px;
    }

    .content-content {
      max-width: 60%;
      min-height: 40px;
      line-height: 25px;
      padding: 5px;
      margin-left: 7px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      position: relative;
      background: white;
      word-break: break-all;
      border: 1px solid #e7e7e7;

      .chat-picture {
        display: flex;
        align-items: center;
      }
      .chat-voice {
        width: 300px;
        max-width: 100%;
        display: flex;
        align-items: center;
      }
      :deep(.chat-video) {
        display: flex;
        align-items: center;
        position: relative;
        .play-video {
          color: #98e165;
          position: absolute;
          font-size: 50px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          cursor: pointer;
        }
      }
      :deep(.chat-system) {
        color: gray;
        a {
          color: #41c0fc;
        }
      }
      :deep(.chat-stranger-tip) {
        color: #c45656;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.5;
        letter-spacing: 0.02em;
      }
      :deep(.chat-link) {
        flex-direction: column;
        width: 300px;
        max-width: 100%;
        cursor: pointer;
        .link-title {
          font-size: 16px;
          font-weight: 600;
        }
        .link-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          .link-des {
            flex: auto;
            color: #aaaaaa;
            font-size: 14px;
            margin-right: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            word-break: break-all;
            word-wrap: break-word;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
          }
          .link-img {
            max-width: 50px;
            max-height: 50px;
            min-height: 50px;
            min-width: 50px;
            border-radius: 5px;
          }
        }
        .link-type {
          color: #aaaaaa;
          margin-top: 5px;
          text-align: start;
          border-top: solid #e8eaec 1px;
        }
      }
      :deep(.chat-file) {
        flex-direction: column;
        width: 300px;
        max-width: 100%;
        cursor: pointer;
        .file-title {
          font-size: 16px;
          font-weight: 600;
        }
        .file-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          .file-des {
            flex: auto;
            color: #aaaaaa;
            font-size: 14px;
            margin-right: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            word-break: break-all;
            word-wrap: break-word;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
          }
          .file-icon {
            font-size: 30px;
            margin-right: 20px;
          }
        }
        .file-type {
          color: #aaaaaa;
          margin-top: 5px;
          text-align: start;
          border-top: solid #e8eaec 1px;
        }
      }
      :deep(.chat-app) {
        width: 300px;
        max-width: 100%;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        .app-des {
          display: flex;
          .app-icon {
            width: 20px;
            height: 20px;
          }
          .app-source {
            width: 100%;
            font-size: 12px;
            margin-left: 5px;
            color: gray;
          }
        }
        .app-title {
          width: 100%;
          height: 30px;
          font-size: 14px;
          font-weight: 600;
          line-height: 30px;
        }
        .app-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          .app-des {
            flex: auto;
            color: #aaaaaa;
            font-size: 14px;
            margin-right: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            word-break: break-all;
            word-wrap: break-word;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
          }
          .app-img {
            max-width: 50px;
            max-height: 50px;
            min-height: 50px;
            min-width: 50px;
            border-radius: 5px;
          }
        }
        .app-img {
          align-self: center;
          max-width: 200px;
        }
        .app-typestr {
          height: 25px;
          margin-top: 5px;
          line-height: 25px;
          color: gray;
          text-align: start;
          border-top: solid #aaaaaa 1px;
        }
      }
      :deep(.chat-namecard) {
        width: 300px;
        max-width: 100%;
        cursor: pointer;
        .namecard-info {
          display: flex;
          align-items: center;
          .namecard-img {
            height: 50px;
            width: 50px;
            min-width: 50px;
            border-radius: 5px;
          }
          .namecard-nickname {
            width: 250px;
            font-size: 14px;
            margin-left: 5px;
          }
        }
        .namecard-tip {
          color: gray;
          margin-top: 5px;
          border-top: #aaaaaa solid 1px;
        }
      }
      &.chat-luckmoney {
        background: linear-gradient(180deg, #fb9a4d 0%, #f58c3a 50%, #ed7a28 100%) !important;
        border: none !important;
        padding: 0 !important;
        border-radius: 8px;
        cursor: pointer;
        &:hover {
          background: linear-gradient(180deg, #fca65d 0%, #fb9a4d 50%, #f58c3a 100%) !important;
        }
        &.triangle::before {
          border-right-color: #e06d18;
        }
        &.triangle::after {
          border-right-color: #f58c3a;
        }
        &.triangle-send::before {
          border-left-color: #e06d18;
        }
        &.triangle-send::after {
          border-left-color: #f58c3a;
        }
      }
      :deep(.chat-luckmoney) {
        display: block;
        width: 100%;
        padding: 0;
        max-width: 260px;
        min-width: 220px;
        cursor: pointer;
        border-radius: 6px;
        overflow: hidden;
        .luck-info {
          display: flex;
          align-items: center;
          padding: 12px 14px 10px;
          .luck-icon {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #d96b3a;
            border-radius: 4px;
            .iconfont {
              font-size: 24px;
              color: #e8b923;
            }
          }
          .luck-wish {
            flex: 1;
            font-size: 15px;
            color: #fff;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          &.luck-opened .luck-amount {
            flex: 1;
            font-size: 18px;
            color: #fff;
            font-weight: 600;
          }
          &.luck-opened .luck-claimed-tip {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.9);
            margin-left: 4px;
          }
        }
        .luck-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.3);
          margin: 0 12px;
        }
        .luckmoney-tip {
          padding: 8px 14px 10px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.95);
        }
      }
      :deep(.chat-moneytran) {
        width: 300px;
        max-width: 100%;
        background: #fa9d3b;
        cursor: pointer;
        .moneytran-info {
          display: flex;
          align-items: center;
          height: 60px;
          width: 100%;
          .moneytran-img {
            max-width: 30px;
            margin-left: 10px;
          }
          .moneytran-feed,
          .moneytran-flag {
            font-size: 14px;
            margin-left: 10px;
            color: white;
          }
        }
        .moneytran-tip {
          color: gray;
          background: white;
          margin-top: 5px;
        }
        &:hover {
          background: rgba($color: #fa9d3b, $alpha: 0.9);
        }
      }
    }

    .send-state {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .send-fail-resend-icon {
      color: #f56c6c;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      &:active {
        opacity: 0.85;
      }
    }

    .chat-room {
      margin-top: 20px;
    }
    .triangle {
      &::before {
        content: '';
        border: 6px solid transparent;
        border-right: 6px solid #e7e7e7;
        position: absolute;
        top: 10px;
        left: -13px;
      }
      &::after {
        content: '';
        border: 6px solid transparent;
        border-right: 6px solid white;
        position: absolute;
        top: 10px;
        left: -12px;
      }
      &:hover {
        background-color: #f6f6f6;
        &::after {
          content: '';
          border: 6px solid transparent;
          border-right: 6px solid #f6f6f6;
          position: absolute;
          top: 10px;
          left: -12px;
        }
      }
    }
    .triangle-send {
      margin-right: 7px;
      background: linear-gradient(135deg, #d4f4dd 0%, #b8e6c5 100%);
      box-shadow: 0 1px 4px rgba(16, 185, 129, 0.15);
      &::before {
        content: '';
        border: 6px solid transparent;
        border-left: 6px solid #e7e7e7;
        position: absolute;
        top: 10px;
        right: -13px;
      }
      &::after {
        content: '';
        border: 6px solid transparent;
        border-left: 6px solid #d4f4dd;
        position: absolute;
        top: 10px;
        right: -12px;
      }

      &:hover {
        background: linear-gradient(135deg, #c8efd4 0%, #a8ddb8 100%);
        &::after {
          border-left: 6px solid #c8efd4;
        }
      }
    }
    .system-info {
      border: none;
      max-width: 80%;
      margin: 0 auto;
      background: inherit;
    }
    .system-info.stranger-tip {
      max-width: 92%;
      margin: 6px auto;
      padding: 10px 16px;
      border-radius: 8px;
      background: #fef0f0;
      border: 1px solid #fde2e2;
      box-shadow: 0 1px 2px rgba(245, 108, 108, 0.12);
      text-align: center;
    }
  }

  .chat-content-send {
    flex-direction: row-reverse;
    .img {
      margin: 5px 0 5px 5px;
    }
  }
}
.msg-select-check {
  margin: 8px 4px 0;
  align-self: flex-start;
}
.msg-translation {
  margin-top: 4px;
  padding: 4px 6px;
  font-size: 12px;
  color: #909399;
  background: #f4f4f5;
  border-radius: 2px;
  max-width: 100%;
  word-break: break-word;
}

.msg-resource-fetch-error {
  margin-top: 4px;
  padding: 4px 6px;
  font-size: 12px;
  color: #f56c6c;
  background: #fef0f0;
  border-radius: 2px;
  max-width: 100%;
  word-break: break-word;
}
</style>
