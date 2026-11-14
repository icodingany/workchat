<template>
  <div class="friend-chat-msg-list">
    <div v-if="showLoadEarlier" class="load-earlier">
      <span v-if="hasNoMoreEarlier" class="done">已加载全部聊天记录</span>
      <a v-else href="javascript:;" @click.prevent="$emit('load-earlier')">点击加载更早的消息</a>
    </div>
    <div ref="scrollBody" class="scroll-body show-chats" v-loading="loading">
      <div v-if="!loading && !messages.length" class="empty">{{ emptyText }}</div>
      <div v-for="(chat, index) in displayChats" :key="msgKey(chat, index)" class="chat-item">
        <div class="chat-time">{{ formatTime(chat) }}</div>
        <div class="chat-content" :class="{ 'chat-content-send': isSelf(chat) }">
          <img class="img" v-if="!isSystem(chat)" :src="avatarOf(chat)" alt="" @error="onAvatarError" />
          <div
            class="content-content"
            :class="[
              { 'triangle-send': isSelf(chat) && !isSystem(chat) },
              { triangle: !isSelf(chat) && !isSystem(chat) },
              { 'system-info': isSystem(chat) }
            ]"
          >
            <div :class="contentTypeClass(chat)" v-html="decodeChat(chat)"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 管理端好友聊天只读列表：布局/解码对齐客服端 ShowChats，
 * 展示形态参考 kelailaichatpc WechatAccountMessageList + MessageContentCell。
 */
import { decodeChatHtml } from '@/utils/decodeChatHtml'
import { sameWxId } from '@/utils/wechat'
import { chatContentClasses, isSystemContentType } from '@/utils/chatContentClasses'
import fallbackAvatar from '@/assets/images/logo-min.png'

const CONTENT_TYPE_NAME = {
  0: 'UnknownContent',
  1: 'Text',
  2: 'Picture',
  3: 'Voice',
  4: 'Video',
  5: 'System',
  6: 'Link',
  7: 'LinkExt',
  8: 'File',
  9: 'NameCard',
  10: 'Location',
  11: 'LuckyMoney',
  12: 'MoneyTrans',
  13: 'WeApp',
  14: 'Emoji',
  15: 'RoomManage',
  16: 'Sys_LuckyMoney',
  17: 'RoomSystem',
  18: 'BizLink',
  19: 'AudioCall',
  20: 'VideoCall',
  21: 'NotifyMsg',
  22: 'QuoteMsg',
  23: 'ForwardMsg',
  24: 'SnsNotify',
  25: 'ShiPinHao',
  26: 'AppFunCard',
  99: 'UnSupport'
}

function normalizeContentType(type) {
  if (type === null || type === undefined || type === '') return type
  if (typeof type === 'number') return CONTENT_TYPE_NAME[type] || type
  if (typeof type === 'string' && /^\d+$/.test(type)) {
    const n = Number(type)
    return CONTENT_TYPE_NAME[n] || n
  }
  return type
}

function decodeMsgContent(content) {
  if (!content || typeof content !== 'string') return content || ''
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<')) {
    return content
  }
  try {
    if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed) || trimmed.length < 8) return content
    const bin = typeof atob === 'function' ? atob(trimmed.replace(/\s/g, '')) : ''
    if (!bin) return content
    let text = bin
    try {
      text = decodeURIComponent(escape(bin))
    } catch (e) {
      /* keep */
    }
    const t = String(text).trim()
    if (t.startsWith('{') || t.startsWith('[') || /[\u4e00-\u9fff]/.test(t) || /^[\x20-\x7e\s]+$/.test(t)) {
      return text
    }
    return content
  } catch (e) {
    return content
  }
}

function parseJsonContent(content) {
  if (!content || typeof content !== 'string') return null
  const t = content.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return null
  try {
    return JSON.parse(t)
  } catch (e) {
    return null
  }
}

/** 对齐 ShowChats.chats()：归一类型、解码、解析 jContent */
export function enrichHistoryChat(raw) {
  const chat = { ...(raw || {}) }
  chat.ContentType = normalizeContentType(chat.ContentType != null ? chat.ContentType : chat.contentType)
  const rawContent = chat.Content != null ? chat.Content : chat.content
  if (rawContent) {
    const decoded = decodeMsgContent(String(rawContent))
    chat.Content = decoded
    if (!chat.jContent) {
      chat.jContent = parseJsonContent(decoded)
    }
  }
  return chat
}

export default {
  name: 'FriendChatMessageList',
  props: {
    messages: { type: Array, default: () => [] },
    wxId: { type: [String, Number], default: '' },
    friendAvatar: { type: String, default: '' },
    friendName: { type: String, default: '' },
    wechatAvatar: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    emptyText: { type: String, default: '暂无聊天记录' },
    showLoadEarlier: { type: Boolean, default: false },
    hasNoMoreEarlier: { type: Boolean, default: false }
  },
  data() {
    return {
      fallbackAvatar,
      luckMoneyMap: {}
    }
  },
  computed: {
    displayChats() {
      return (this.messages || []).map(enrichHistoryChat)
    }
  },
  methods: {
    msgKey(chat, index) {
      return `${chat.MsgId || ''}-${chat.MsgRemoteId || ''}-${chat.MsgTime || ''}-${index}`
    },
    isSelf(chat) {
      if (sameWxId(chat && chat.SenderId, this.wxId)) return true
      const send = chat && (chat.isSend != null ? chat.isSend : chat.IsSend)
      return send === 1 || send === '1' || send === true || send === 'true'
    },
    isSystem(chat) {
      return isSystemContentType(chat && chat.ContentType)
    },
    avatarOf(chat) {
      if (this.isSelf(chat)) return this.wechatAvatar || this.fallbackAvatar
      return this.friendAvatar || this.fallbackAvatar
    },
    onAvatarError(e) {
      if (e && e.target) e.target.src = this.fallbackAvatar
    },
    formatTime(chat) {
      const t = chat && (chat.MsgTime != null ? chat.MsgTime : chat.CreateTime)
      if (t == null || t === '') return ''
      let n = Number(t)
      if (!Number.isFinite(n)) {
        const parsed = Date.parse(t)
        n = Number.isFinite(parsed) ? parsed : 0
      }
      if (n > 0 && n < 1e12) n *= 1000
      if (!n) return ''
      const d = new Date(n)
      const pad = (x) => (x < 10 ? `0${x}` : `${x}`)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}`
    },
    contentTypeClass(chat) {
      return {
        ...chatContentClasses(chat && chat.ContentType),
        'chat-system': this.isSystem(chat)
      }
    },
    decodeChat(chat) {
      return decodeChatHtml(chat, {
        luckMoneyMap: this.luckMoneyMap,
        isSelfMsg: (c) => this.isSelf(c),
        friendNick: this.friendName || '对方',
        useCache: false
      })
    },
    scrollToBottom() {
      const el = this.$refs.scrollBody
      if (!el) return
      el.scrollTop = el.scrollHeight
    },
    preserveScrollAfterPrepend(oldHeight) {
      const el = this.$refs.scrollBody
      if (!el) return
      el.scrollTop = Math.max(0, el.scrollHeight - (oldHeight || 0))
    }
  }
}
</script>

<style lang="scss" scoped>
.friend-chat-msg-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ededed;
}
.load-earlier {
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  background: #ededed;
  a {
    color: #409eff;
  }
  .done {
    color: #909399;
  }
}
.scroll-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 8px 0 16px;
}
.empty {
  text-align: center;
  color: #909399;
  padding: 48px 0;
  font-size: 13px;
}

/* 以下样式对齐 ShowChats 对话框气泡 */
.show-chats {
  .chat-item {
    display: flex;
    flex-direction: column;
    margin: 5px 12px;

    .chat-time {
      width: 160px;
      height: 20px;
      font-size: 12px;
      line-height: 20px;
      border-radius: 5px;
      color: white;
      margin: 8px auto;
      align-self: center;
      text-align: center;
      background: #dadada;
    }

    .chat-content {
      display: flex;
      position: relative;
      padding-top: 4px;
      font-size: 12px;
      color: $font-color-base;

      .img {
        width: 42px;
        height: 42px;
        margin: 5px 5px 5px 0;
        border-radius: 4px;
        object-fit: cover;
        background: #e8e8e8;
      }

      .content-content {
        max-width: 60%;
        min-height: 40px;
        line-height: 25px;
        padding: 8px 10px;
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
          }
        }
        :deep(.chat-system) {
          color: gray;
        }
        :deep(.chat-link) {
          flex-direction: column;
          width: 300px;
          max-width: 100%;
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
            }
            .file-icon {
              font-size: 30px;
              margin-right: 20px;
            }
          }
          .file-type {
            color: #aaaaaa;
            margin-top: 5px;
            border-top: solid #e8eaec 1px;
          }
        }
        :deep(.chat-app) {
          width: 300px;
          max-width: 100%;
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
            border-top: solid #aaaaaa 1px;
          }
        }
        :deep(.chat-namecard) {
          width: 300px;
          max-width: 100%;
          .namecard-info {
            display: flex;
            align-items: center;
            .namecard-img {
              height: 50px;
              width: 50px;
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
        :deep(.chat-luckmoney) {
          display: block;
          width: 100%;
          padding: 0;
          max-width: 260px;
          min-width: 220px;
          background: linear-gradient(180deg, #fb9a4d 0%, #f58c3a 50%, #ed7a28 100%);
          border-radius: 8px;
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
          .moneytran-info {
            display: flex;
            align-items: center;
            height: 60px;
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
            padding: 4px 8px;
          }
        }
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
      }

      .system-info {
        margin: 0 auto;
        background: transparent;
        border: none;
        color: #999;
        max-width: 80%;
        justify-content: center;
      }
    }

    .chat-content-send {
      flex-direction: row-reverse;
      .img {
        margin: 5px 0 5px 5px;
      }
      .content-content {
        margin-left: 0;
        margin-right: 7px;
        background: #98e165;
        border-color: #98e165;
      }
      .triangle-send {
        &::before {
          content: '';
          border: 6px solid transparent;
          border-left: 6px solid #98e165;
          position: absolute;
          top: 10px;
          right: -13px;
          left: auto;
        }
        &::after {
          content: '';
          border: 6px solid transparent;
          border-left: 6px solid #98e165;
          position: absolute;
          top: 10px;
          right: -12px;
          left: auto;
        }
      }
    }
  }
}
</style>
