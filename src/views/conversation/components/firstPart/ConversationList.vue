<template>
  <div class="conversation-list" :class="{ 'mobile-conversation-list': mobileLayout }">
    <!-- 搜索 -->
    <div class="search-box">
      <el-input
        class="search-input"
        prefix-icon="el-icon-search"
        type="text"
        placeholder="请输入内容"
        maxlength="20"
        clearable
        show-word-limit
        v-model.trim.lazy="searchInfo"
      ></el-input>
    </div>

    <!-- 会话列表：置顶独立区域 + 普通列表 chunk(20) 窗口化渲染（对齐 kelailaichatpc） -->
    <div id="conversationsList" class="friends-content scroll" @scroll="handlerScroll">
      <template v-if="hasListContent">
        <!-- 置顶聊天区域 -->
        <div v-if="hasTopChats" class="top-chats-section">
          <div
            v-if="needTopCollapse"
            class="collapse-top-chats"
            @click="toggleTopExpanded"
          >
            <i class="fa" :class="topExpanded ? 'fa-compress' : 'fa-expand'" aria-hidden="true"></i>
            <span>{{ topExpanded ? '收起置顶聊天' : '展开置顶聊天' }}</span>
            <i class="fa" :class="topExpanded ? 'fa-angle-up' : 'fa-angle-down'" aria-hidden="true"></i>
          </div>
          <div
            v-for="message in displayTopChats"
            :key="convItemKey(message) + '-top'"
            class="friend-info top-conv-item"
            :class="{ selected: message.RemoteId == currentFriendId }"
            @click="choseFriend(message)"
            @contextmenu.prevent="showContextMenu($event, message)"
          >
            <div class="avatar-tip">
              <div v-if="convAvatarList(message).length" class="img avatars">
                <img
                  :class="'avatar' + '-' + convAvatarList(message).length"
                  v-for="(avatar, index) in convAvatarList(message)"
                  :key="index"
                  :src="avatar"
                  alt
                />
              </div>
              <img
                v-else-if="!isGroup(message) && convAvatarUrl(message)"
                class="img"
                :src="convAvatarUrl(message)"
                alt="头像"
              />
              <img
                v-else-if="isGroup(message)"
                class="img"
                :src="wechatGroupAvatar"
                alt="群聊"
              />
              <el-avatar v-else shape="square" :size="36">
                <i class="fa fa-picture-o" aria-hidden="true" title="头像miss"></i>
              </el-avatar>
              <div
                v-if="showUnreadBadge(message)"
                class="tip"
                v-text="message.UnreadCnt < 99 ? message.UnreadCnt : '...'"
                :title="message.UnreadCnt"
              ></div>
            </div>
            <div class="nick-content">
              <div class="friend-nick ellipsis">
                <span v-text="message.Alias || message.Name"></span>
                <span v-if="nickSuffix(message)" style="color: #67c23a">&nbsp;@{{ nickSuffix(message) }}</span>
              </div>
              <div class="chat-content ellipsis" v-text="displayDigest(message)"></div>
            </div>
            <div class="time-disturb">
              <div v-text="$filters.transformTime(message.UpdateTime)"></div>
              <div class="opration-btns">
                <i
                  class="fa fa-thumb-tack top-convs"
                  aria-hidden="true"
                  title="置顶"
                  @click.stop="setTop(message)"
                ></i>
                <i
                  v-if="!message.Members"
                  class="fa fa-retweet sigle-fresh"
                  aria-hidden="true"
                  title="刷新"
                  @click.stop="$parent.getFriendDetail(message)"
                ></i>
                <i
                  v-if="isSilent(message)"
                  class="fa fa-bell-slash msg-silent"
                  aria-hidden="true"
                  title="免打扰"
                ></i>
                <i
                  v-if="!message.UnreadCnt"
                  class="fa fa-exclamation-circle"
                  aria-hidden="true"
                  title="设为未读"
                  @click.stop="setUnread(message)"
                ></i>
              </div>
            </div>
          </div>
          <div
            v-if="needTopCollapse && !topExpanded"
            class="expand-top-chats-tip"
            @click="toggleTopExpanded"
          >
            <span>还有 {{ topChats.length - topChatMaxVisibleCount }} 条置顶聊天，点击展开</span>
          </div>
        </div>
        <div v-if="hasTopChats && visibleNormalChats.length" class="chats-divider"></div>
        <!-- 普通会话列表 -->
        <template v-if="visibleNormalChats.length">
          <template v-for="(chunk, chunkIndex) in chunkData" :key="'chunk-' + chunkIndex">
            <div
              v-for="message in chunk"
              :key="convItemKey(message)"
              class="friend-info"
              :class="{ selected: message.RemoteId == currentFriendId }"
              @click="choseFriend(message)"
              @contextmenu.prevent="showContextMenu($event, message)"
            >
            <!-- 头像和提示 -->
            <div class="avatar-tip">
              <div v-if="convAvatarList(message).length" class="img avatars">
                <img
                  :class="'avatar' + '-' + convAvatarList(message).length"
                  v-for="(avatar, index) in convAvatarList(message)"
                  :key="index"
                  :src="avatar"
                  alt
                />
              </div>
              <img
                v-else-if="!isGroup(message) && convAvatarUrl(message)"
                class="img"
                :src="convAvatarUrl(message)"
                alt="头像"
              />
              <img
                v-else-if="isGroup(message)"
                class="img"
                :src="wechatGroupAvatar"
                alt="群聊"
              />
              <el-avatar v-else shape="square" :size="36">
                <i class="fa fa-picture-o" aria-hidden="true" title="头像miss"></i>
              </el-avatar>

              <!-- 未读消息数（免打扰不显示） -->
              <div
                v-if="showUnreadBadge(message)"
                class="tip"
                v-text="message.UnreadCnt < 99 ? message.UnreadCnt : '...'"
                :title="message.UnreadCnt"
              ></div>
            </div>

            <!-- 昵称和消息内容 -->
            <div class="nick-content">
              <div class="friend-nick ellipsis">
                <span v-text="message.Alias || message.Name"></span>
                <span v-if="nickSuffix(message)" style="color: #67c23a">&nbsp;@{{ nickSuffix(message) }}</span>
              </div>
              <div class="chat-content ellipsis" v-text="displayDigest(message)"></div>
            </div>
            <!-- 时间 | 置顶 | 刷新 | 免打扰 | 设为未读 -->
            <div class="time-disturb">
              <div v-text="$filters.transformTime(message.UpdateTime)"></div>
              <div class="opration-btns">
                <i
                  class="fa fa-thumb-tack"
                  :class="{ 'top-convs': isTop(message) }"
                  aria-hidden="true"
                  title="置顶"
                  @click.stop="setTop(message)"
                ></i>
                <i
                  v-if="!message.Members"
                  class="fa fa-retweet sigle-fresh"
                  aria-hidden="true"
                  title="刷新"
                  @click.stop="$parent.getFriendDetail(message)"
                ></i>
                <i
                  v-if="isSilent(message)"
                  class="fa fa-bell-slash msg-silent"
                  aria-hidden="true"
                  title="免打扰"
                ></i>
                <i
                  v-if="!message.UnreadCnt"
                  class="fa fa-exclamation-circle"
                  aria-hidden="true"
                  title="设为未读"
                  @click.stop="setUnread(message)"
                ></i>
              </div>
            </div>
            </div>
          </template>
        </template>
      </template>
      <div v-else class="current-info-null">搜索不到结果！</div>
    </div>

    <div class="friends-bottom">
      共 {{ currentConvs.length }} 个
      <el-button link icon="el-icon-refresh" @click="refreshConversation">刷新</el-button>
    </div>

    <!-- 右键菜单：免打扰 -->
    <ul
      v-show="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
    >
      <li @click="onContextMsgSilent">
        {{ contextFriend && isSilent(contextFriend) ? '取消免打扰' : '消息免打扰' }}
      </li>
    </ul>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { chunk } from 'lodash'
import { normalizeId, sameId, weComNickSuffix, getConversationAvatarList, resolveConversationAvatarUrl } from '@/utils/wechat'
import wechatGroupAvatar from '@/assets/images/wechatGroup.png'
import { TriggerConversationPushTask, chatRoomActionTask } from '@/api/webSocketApi'
import {
  shouldShowConversationUnreadBadge,
  isConversationDigestPinned
} from '@/utils/conversationDigest'
import { isGroupConversation } from '@/utils/conversationSort'
import { convDiag, uiBlockSnap } from '@/utils/convClickDiag'
import { buildSlimSelectContact } from '@/utils/slimSelectContact'

/** ChatRoomAction：免打扰 / 置顶（与手机 SDK 枚举一致） */
const ACTION_NO_DISTURB = 6
const ACTION_SET_TOP = 16
/** 对齐 kelailaichatpc：每块渲染条数 / 触底扩容步长 / 折叠时置顶可见条数 */
const CONV_CHUNK_SIZE = 20
const CONV_REVEAL_STEP = 80
const TOP_CHAT_MAX_VISIBLE_COUNT = 1

export default {
  name: 'ConversationList',
  inject: {
    mobileOpenChat: { default: null }
  },
  props: {
    /** 移动端全宽布局 */
    mobileLayout: {
      type: Boolean,
      default: false
    },
    /** 仅展示有未读角标的会话 */
    onlyUnreadFilter: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      wechatGroupAvatar,
      searchInfo: '', // 搜索内容
      maxNumber: 20,
      topExpanded: true, // 置顶区域展开状态
      topChatMaxVisibleCount: TOP_CHAT_MAX_VISIBLE_COUNT,
      contextMenuVisible: false,
      contextMenuX: 0,
      contextMenuY: 0,
      contextFriend: null
    }
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId', // 当前选择的微信
      currentConvs: 'conversation/currentConvs', // 当前的会话列表
      contactsMap: 'conversation/contactsMap', // remoteId对应的信息
      currentFriendId: 'conversation/currentFriendId' // 当前微信选的好友
    }),
    /** 搜索过滤后的全量会话（搜索不过 maxNumber） */
    filteredConvs() {
      let list = this.currentConvs || []
      if (this.onlyUnreadFilter) {
        list = list.filter((x) => shouldShowConversationUnreadBadge(x))
      }
      if (!this.searchInfo) return list
      const kw = this.searchInfo
      return list.filter((x) => {
        const name = x.Name || x.Alias || ''
        return name.indexOf(kw) >= 0
      })
    },
    topChats() {
      return this.filteredConvs.filter((m) => this.isTop(m))
    },
    normalChats() {
      return this.filteredConvs.filter((m) => !this.isTop(m))
    },
    hasTopChats() {
      return this.topChats.length > 0
    },
    needTopCollapse() {
      return this.topChats.length > this.topChatMaxVisibleCount
    },
    displayTopChats() {
      if (!this.needTopCollapse || this.topExpanded) return this.topChats
      return this.topChats.slice(0, this.topChatMaxVisibleCount)
    },
    /** 普通会话窗口化可见列表（置顶不计入 maxNumber） */
    visibleNormalChats() {
      if (this.searchInfo) return this.normalChats
      return this.normalChats.slice(0, this.maxNumber)
    },
    hasListContent() {
      return this.displayTopChats.length > 0 || this.visibleNormalChats.length > 0
    },
    /** 分块渲染普通列表，减轻大列表一次性 patch */
    chunkData() {
      return chunk(this.visibleNormalChats, CONV_CHUNK_SIZE)
    }
  },
  watch: {
    currentWeChatId() {
      // 对齐 kelailaichatpc 切号：抬起步长基线
      this.maxNumber = 40
    }
  },
  beforeUnmount() {
    document.removeEventListener('click', this.hideContextMenu)
  },
  methods: {
    convItemKey(message) {
      const wx = (message && (message.WxId || message.WeChatId)) || this.currentWeChatId || ''
      const rid = (message && message.RemoteId) || ''
      return `${wx}-${rid}`
    },
    nickSuffix(message) {
      return weComNickSuffix(message, this.contactsMap)
    },
    convAvatarList(message) {
      return getConversationAvatarList(message)
    },
    convAvatarUrl(message) {
      return resolveConversationAvatarUrl(message)
    },
    isGroup(message) {
      return isGroupConversation(message)
    },
    /** 是否置顶 */
    isTop(message) {
      return !!(message && (message.isTop || message.IsTop))
    },
    /** 是否免打扰：Notified=是否新消息提示，false 表示免打扰 */
    isSilent(message) {
      return !!(message && message.Notified === false)
    },
    showUnreadBadge(message) {
      return shouldShowConversationUnreadBadge(message)
    },
    displayDigest(message) {
      if (isConversationDigestPinned(message) && message.PinnedDigest) {
        return message.PinnedDigest
      }
      return (message && message.Digest) || ''
    },
    // 刷新：保留当前列表 → HTTP 镜像分页 → 并行 Trigger 手机最新（避免先清空闪空）
    async refreshConversation() {
      const wxId = this.currentWeChatId
      if (!wxId) {
        this.$message({
          message: '请先选中微信',
          type: 'warning'
        })
        return
      }
      TriggerConversationPushTask(wxId)
      try {
        const saved = await this.$store.dispatch('conversation/LoadConversationSnapshot', {
          wxId,
          maxRecords: 300
        })
        if (saved > 0) {
          this.$message.success(`已刷新 ${saved} 条会话`)
        }
      } catch (e) {
        console.warn('refreshConversation snapshot failed', e)
      }
    },
    // 选择好友或会话
    choseFriend(message) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const prevId = this.currentFriendId
      const remoteId = message && message.RemoteId
      const wsState = this.$store && this.$store.state && this.$store.state.webSocketState
      const ui = uiBlockSnap()
      convDiag('[conv-click] start', {
        remoteId: remoteId != null ? String(remoteId) : '',
        name: message && (message.Alias || message.Name),
        prevId: prevId != null ? String(prevId) : '',
        wxId: this.currentWeChatId,
        wsState,
        unread: message && message.UnreadCnt,
        ...ui
      })

      if (!message || !message.RemoteId) {
        convDiag('[conv-click] 无响应：会话项缺少 RemoteId', { hasMessage: !!message })
        return
      }
      let otherInfo = {}

      // 如果有未读消息，延后已读（对齐 kelailaichatpc：不与 OpenSession 抢主线程）
      // 连点只保留最后一次已读，避免十几次 SetConvReaded + WS 堆叠
      if (message.UnreadCnt && message.UnreadCnt > 0) {
        let readMsg = {
          WxId: this.currentWeChatId,
          RemoteId: message.RemoteId,
          Id: message.Id
        }
        if (this._markReadTimer) {
          clearTimeout(this._markReadTimer)
          this._markReadTimer = null
        }
        this._markReadTimer = setTimeout(() => {
          this._markReadTimer = null
          this.$store.dispatch('conversation/SetConvReaded', readMsg)
          this.$store.dispatch('websocket/TriggerMessageReadTask', readMsg)
        }, 300)
      }

      // 已选中同一会话：只处理已读，避免 RESET + OpenSession 重入卡主线程
      if (sameId(remoteId, this.currentFriendId)) {
        convDiag('[conv-click] 同会话短路（仅已读）', { remoteId: String(remoteId) })
        if (this.mobileOpenChat) this.mobileOpenChat(message)
        return
      }

      try {
        // 会话对应的联系人信息（只取引用，不整对象展开进 Vuex）
        if (this.contactsMap[normalizeId(remoteId)] || this.contactsMap[remoteId]) {
          otherInfo = this.contactsMap[normalizeId(remoteId)] || this.contactsMap[remoteId]
        }
        const customers = this.$store.getters['conversation/currentCustomers'] || []
        const cust = customers.find(
          (c) => String(c.RemoteId) === String(remoteId) || String(c.RemoteId) === String(normalizeId(remoteId))
        )
        // 轻量 contact + Members markRaw，避免连点把大群成员做成深度响应式卡死 tab
        const contact = buildSlimSelectContact(
          message,
          otherInfo,
          (cust && cust.LabelIds) || message.LabelIds || (otherInfo && otherInfo.LabelIds) || []
        )
        if (isGroupConversation(message) && !resolveConversationAvatarUrl(contact)) {
          contact.Avatar = wechatGroupAvatar
        }
        this.$store.commit('conversation/SET_CURRENT_FRIENDS', {
          wxid: this.currentWeChatId,
          contact
        })

        const cost = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
        convDiag('[conv-click] committed', {
          remoteId: String(normalizeId(remoteId)),
          costMs: cost,
          members: contact.Members ? contact.Members.length : 0
        })
        if (cost > 100) {
          convDiag('[conv-click] 同步处理过慢', { costMs: cost, remoteId: String(remoteId) })
        }

        // 下一帧探测：若第二下卡死在渲染，这里会迟到或再也打不出
        const paintAt = Date.now()
        requestAnimationFrame(() => {
          convDiag('[conv-click] rAF', {
            remoteId: String(normalizeId(remoteId)),
            paintMs: Date.now() - paintAt
          })
        })

        if (this.mobileOpenChat) {
          this.mobileOpenChat(message)
        }

        this.$nextTick(() => {
          const nowId = this.currentFriendId
          if (!sameId(nowId, remoteId)) {
            convDiag('[conv-click] 切换未生效', {
              expect: String(remoteId),
              actual: nowId != null ? String(nowId) : '',
              prevId: prevId != null ? String(prevId) : ''
            })
          }
        })

        // OpenSession 防抖落地后：超时仍无消息则打警告
        const expectRid = normalizeId(remoteId)
        const clickedAt = Date.now()
        setTimeout(() => {
          if (!sameId(this.currentFriendId, expectRid)) return
          const cc = this.$store.getters['conversation/currentChats'] || {}
          const msgLen = (cc.Messages && cc.Messages.length) || 0
          const sameConv = sameId(cc.ConvId, expectRid)
          if (!sameConv || msgLen === 0) {
            convDiag('[conv-click] 打开后仍无消息', {
              expectRid: String(expectRid),
              friendId: this.currentFriendId != null ? String(this.currentFriendId) : '',
              convId: cc.ConvId != null ? String(cc.ConvId) : '',
              msgLen,
              elapsedMs: Date.now() - clickedAt,
              wsState: this.$store.state && this.$store.state.webSocketState
            })
          } else {
            convDiag('[conv-click] OpenSession 已可见', {
              expectRid: String(expectRid),
              msgLen,
              elapsedMs: Date.now() - clickedAt
            })
          }
        }, 1200)
      } catch (e) {
        convDiag('[conv-click] 异常', { err: String(e && e.message ? e.message : e) })
        console.error('[conv-click] 异常导致无响应', e)
      }
    },
    // 置顶 / 取消置顶（ConvId 优先 RemoteId，与手机 getConversationByRemoteId 对齐）
    setTop(message) {
      if (!this.currentWeChatId || !message || !message.RemoteId) return
      const enable = !this.isTop(message)
      const taskId = chatRoomActionTask(this.currentWeChatId, message.RemoteId, ACTION_SET_TOP, {
        IntValue: enable ? 1 : 0
      })
      this.$store.dispatch('conversation/PatchConversationFlags', {
        WxId: this.currentWeChatId,
        RemoteId: message.RemoteId,
        isTop: enable
      })
      this.$store.commit('conversation/SET_PENDING_CONV_FLAG', {
        taskId,
        WxId: this.currentWeChatId,
        RemoteId: message.RemoteId,
        action: ACTION_SET_TOP,
        isTop: enable,
        prevIsTop: !enable
      })
      this.$message.success('任务已经下发！')
    },
    // 免打扰 / 取消
    msgSilent(message) {
      if (!this.currentWeChatId || !message || !message.RemoteId) return
      const enable = !this.isSilent(message)
      const taskId = chatRoomActionTask(this.currentWeChatId, message.RemoteId, ACTION_NO_DISTURB, {
        IntValue: enable ? 1 : 0
      })
      // Notified=是否新消息提示，开启免打扰后为 false
      this.$store.dispatch('conversation/PatchConversationFlags', {
        WxId: this.currentWeChatId,
        RemoteId: message.RemoteId,
        Notified: !enable
      })
      this.$store.commit('conversation/SET_PENDING_CONV_FLAG', {
        taskId,
        WxId: this.currentWeChatId,
        RemoteId: message.RemoteId,
        action: ACTION_NO_DISTURB,
        Notified: !enable,
        prevNotified: enable
      })
      this.$message.success('任务已经下发！')
    },
    // 设为未读（仅 PC 本地）
    setUnread(message) {
      if (!this.currentWeChatId || !message || !message.RemoteId) return
      this.$store.dispatch('conversation/SetConvUnread', {
        WxId: this.currentWeChatId,
        RemoteId: message.RemoteId
      })
      this.$message.success('已标记未读')
    },
    showContextMenu(event, friend) {
      this.contextFriend = friend
      this.contextMenuVisible = true
      this.contextMenuX = event.clientX
      this.contextMenuY = event.clientY
      this.$nextTick(() => {
        document.addEventListener('click', this.hideContextMenu)
      })
    },
    hideContextMenu() {
      this.contextMenuVisible = false
      document.removeEventListener('click', this.hideContextMenu)
    },
    onContextMsgSilent() {
      if (this.contextFriend) {
        this.msgSilent(this.contextFriend)
      }
      this.hideContextMenu()
    },
    toggleTopExpanded() {
      this.topExpanded = !this.topExpanded
    },
    // 滚动加载：对齐 kelailaichatpc 触底 +80（仅扩容普通会话）
    handlerScroll() {
      if (this.searchInfo) return
      const el = document.getElementById('conversationsList')
      if (!el) return
      const st = el.scrollTop
      const ch = el.clientHeight
      const sh = el.scrollHeight
      if (st + ch + 2 < sh) return
      const len = this.normalChats.length
      if (this.maxNumber >= len) return
      this.maxNumber = Math.min(Math.max(this.maxNumber, 40) + CONV_REVEAL_STEP, len)
    }
  }
}
</script>

<style lang="scss" scoped>
.conversation-list {
  width: 270px;
  min-width: 270px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-right: solid $border-color-base 2px;

  .friends-bottom {
    height: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-around;
    border-top: solid $border-color-base 2px;
  }
  .search-box {
    padding: 5px;
    background-color: $bg-color-content-base;
  }
  .friends-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    overflow-y: scroll;
    background-color: $bg-color-content-base;
    margin-bottom: 5px;

    .top-chats-section {
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .top-conv-item {
      background-color: #f7f7f7;
      border-left: 3px solid #ff9800;
    }

    .chats-divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 8px 0;
    }

    .collapse-top-chats {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px 10px;
      cursor: pointer;
      color: #606266;
      font-size: 12px;
      background-color: #f5f5f5;
      border-radius: 4px;
      transition: all 0.2s;
      margin: 5px 0;

      &:hover {
        background-color: #e6e6e6;
        color: #303133;
      }

      .fa {
        margin: 0 5px;
        font-size: 12px;
      }
    }

    .expand-top-chats-tip {
      text-align: center;
      padding: 5px 10px;
      color: #909399;
      font-size: 12px;
      cursor: pointer;
      background-color: #fafafa;
      border-radius: 4px;
      margin-top: 5px;
      transition: all 0.2s;

      &:hover {
        color: #606266;
        background-color: #f0f0f0;
      }
    }

    .friend-info {
      height: 50px;
      width: 260px;
      overflow: hidden;
      min-height: 50px;
      display: flex;
      cursor: pointer;
      margin-top: 2px;
      border-left: 3px solid transparent;

      .avatar-tip {
        height: 50px;
        width: 50px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;

        .img {
          width: 36px;
          height: 36px;
          margin: 5px;
          font-size: 14px;
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
        .tip {
          border: solid red 1px;
          width: 20px;
          height: 20px;
          position: absolute;
          top: 0px;
          right: 0px;
          background: red;
          border-radius: 10px;
          color: white;
          text-align: center;
        }
      }

      .nick-content {
        width: 140px;
        display: flex;
        flex-direction: column;
        align-self: center;
        font-size: 12px;
        .chat-content {
          max-width: 100%;
          height: 20px;
          line-height: 20px;
        }
        .friend-nick {
          max-width: 100%;
          line-height: 20px;
          @include ellipsis(2);
        }
      }

      .time-disturb {
        width: 70px;
        min-width: 70px;
        display: flex;
        align-items: center;
        justify-content: space-around;
        flex-direction: column;
        font-size: 12px;
        .sigle-fresh:hover,
        .fa-thumb-tack:hover,
        .fa-exclamation-circle:hover {
          color: #41c0fc;
        }
        .top-convs {
          color: #ff9800;
        }
        .msg-silent {
          color: #909399;
        }
        .opration-btns {
          display: flex;
          justify-content: space-around;
          align-items: center;
          width: 60px;
          gap: 2px;
          i {
            cursor: pointer;
            font-size: 12px;
          }
        }
      }

      &:hover {
        background-color: rgba(16, 185, 129, 0.08);
      }
    }
    .current-info-null {
      text-align: center;
      margin-top: 10px;
    }
    .selected {
      background-color: rgba(16, 185, 129, 0.14);
      &:hover {
        background-color: rgba(16, 185, 129, 0.18);
      }
    }
  }

  .context-menu {
    position: fixed;
    z-index: 3000;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    min-width: 120px;
    li {
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      color: #606266;
      &:hover {
        background: #f5f7fa;
        color: #409eff;
      }
    }
  }
}
</style>
