import { mapGetters } from 'vuex'
import { normalizeChatFields } from '@/utils/chatMessageFields'
import {
  buildChatViewFinger,
  finalizeChatViewItem,
  filterDuplicateFriendAddGreetings
} from '@/utils/prepareChatForView'
import { lookupLuckMoneyOpened } from '@/utils/takeLuckMoney'
import { buildForwardRecentConvs } from '@/utils/forwardHelpers'
import { isGroupConversation } from '@/utils/conversationSort'

export default {
  computed: {
    showChatsSessionKey() {
      return this.sessionKey
    },
    ...mapGetters({
      currentMode: 'currentMode', // pc还是web
      isDesktop: 'isDesktop',
      currentUser: 'currentUser', // 当前用户信息
      adminInfo: 'adminInfo',
      currentWechat: 'conversation/currentWechat',
      currentChats: 'conversation/currentChats', // 聊天记录
      currentFriend: 'conversation/currentFriend', // 当前联系人
      currentFriendId: 'conversation/currentFriendId', // 当前联系人
      currentWeChatId: 'conversation/currentWeChatId', // 当前wxid
      contactsMap: 'conversation/contactsMap',
      currentConvs: 'conversation/currentConvs',
      hbDetail: 'conversation/hbDetail',
      luckMoneyMap: 'nedb/luckMoneyMap',
      refundedTransferKeys: 'nedb/refundedTransferKeys',
      atContent: 'conversation/content',
      selectMode: 'conversation/selectMode',
      selectedMsgs: 'conversation/selectedMsgs',
      translations: 'conversation/translations',
      supportsMergeForward: 'conversation/supportsMergeForward',
      currentCustomers: 'conversation/currentCustomers',
      currentContacts: 'conversation/currentContacts',
      bigImageMap: 'conversation/bigImageMap'
    }),
    /** 当前登录客服账号：我方发送消息缺 SenderAccountName 时的展示兜底 */
    fallbackSenderAccount() {
      return (
        (this.adminInfo && this.adminInfo.account) ||
        (this.currentUser && this.currentUser.account) ||
        ''
      )
    },
    /** 转发：最近聊天（排除置顶） */
    forwardRecentConvs() {
      return buildForwardRecentConvs(this.currentConvs, {
        excludeRemoteId: this.currentFriendId
      })
    },
    /** 转发：私聊好友（客户 + 通讯录） */
    forwardPrivateFriends() {
      const customers = this.currentCustomers || []
      const contacts = this.currentContacts || []
      return customers.concat(contacts)
    },
    /** 转发：群聊 */
    forwardGroupConvs() {
      return (this.currentConvs || []).filter(isGroupConversation)
    },
    filteredForwardRecentConvs() {
      const kw = (this.forwardSearchText || '').trim()
      let list = this.forwardRecentConvs
      if (!kw) return list
      return list.filter((x) => {
        const name = x.ShowName || x.Name || x.Alias || ''
        const digest = x.Digest || ''
        return name.indexOf(kw) >= 0 || digest.indexOf(kw) >= 0
      })
    },
    filteredForwardPrivateFriends() {
      const kw = (this.forwardSearchText || '').trim()
      let list = this.forwardPrivateFriends
      if (!kw) return list
      return list.filter((x) => {
        const name = x.Name || x.Alias || x.FriendNick || ''
        const memo = x.Memo || ''
        return name.indexOf(kw) >= 0 || memo.indexOf(kw) >= 0
      })
    },
    filteredForwardGroupConvs() {
      const kw = (this.forwardSearchText || '').trim()
      let list = this.forwardGroupConvs
      if (!kw) return list
      return list.filter((x) => {
        const name = x.ShowName || x.Name || x.Alias || ''
        return name.indexOf(kw) >= 0
      })
    },
    forwardSelectedCount() {
      const sel = this.forwardSelectionByTab || {}
      return (sel.chat || []).length + (sel.friends || []).length + (sel.chatrooms || []).length
    },
    /** 会话 LocalId：优先 currentFriend.Id，否则从会话列表按 RemoteId 回查（保持字符串） */
    currentConvLocalId() {
      const id = this.currentFriend && this.currentFriend.Id
      if (id !== null && id !== undefined && id !== '') return id
      const rid = this.currentFriendId
      const list = this.currentConvs || []
      for (let i = 0; i < list.length; i++) {
        if (String(list[i].RemoteId) === String(rid) && list[i].Id) return list[i].Id
      }
      return 0
    },
    sessionKey() {
      const w = String(this.currentWeChatId || '').trim()
      const f = String(this.currentFriendId || '').trim()
      return w && f ? `${w}_${f}` : 'empty'
    },
    // 消息展示：Content 解码；按消息指纹缓存，避免每次 computed 全量 decode 卡死主线程
    chats() {
      const raw = (this.currentChats && this.currentChats.Messages) || []
      if (!raw.length) return []
      const sessionKey = this.sessionKey
      if (this._chatViewSessionKey !== sessionKey) {
        this._chatViewSessionKey = sessionKey
        this._chatViewCache = Object.create(null)
      }
      const cache = this._chatViewCache || (this._chatViewCache = Object.create(null))
      const decoded = raw.map((x) => {
        const base = normalizeChatFields(x)
        const finger = buildChatViewFinger(base)
        const hit = cache[finger]
        if (hit) return hit
        const xi = finalizeChatViewItem(base)
        cache[finger] = xi
        return xi
      })
      return filterDuplicateFriendAddGreetings(decoded)
    },
    // 群成员map
    membersMap() {
      let mm = {}
      if (this.currentFriend.Members) {
        this.currentFriend.Members.forEach((x) => {
          mm[x.RemoteId] = x
        })
      }
      return mm
    },
    // 显示红包详情
    hbDetailVisible: {
      get() {
        return this.$store.getters['conversation/hbDetailVisible']
      },
      set(v) {
        this.$store.commit('conversation/SET_HB_DETAIL_VISIBLE', v)
        if (!v) {
          this.$store.commit('conversation/SET_HB_DETAIL', {
            WeChatId: '', // 所属微信号
            Success: false,
            ErrMsg: '',
            HbUrl: '', //
            TotalNum: null, // 红包总个数
            TotalAmount: null, // 红包总金额
            RecNum: null, // 已收红包个数
            Records: [], // 已收红包个数
            RecAmount: null // 已收红包金额
          })
          this.hb2detail = {}
        }
      }
    },
    /** 红包/转账弹窗中展示的发送者名称：当前会话联系人，群内回退到消息发送者 */
    hbSenderName() {
      const friend = this.currentFriend
      if (friend && !friend.Members) {
        return friend.Name || friend.ShowName || '企微用户'
      }
      const senderId = this.hb2detail && (this.hb2detail.SenderId || this.hb2detail.SenderWxid)
      if (senderId) {
        const contact = this.contactsMap && this.contactsMap[senderId]
        if (contact && contact.Name) return contact.Name
        return String(senderId)
      }
      return '企微用户'
    },
    /** 红包/转账弹窗中展示的发送者头像 */
    hbSenderAvatar() {
      const friend = this.currentFriend
      if (friend && !friend.Members && friend.Avatar) return friend.Avatar
      const senderId = this.hb2detail && (this.hb2detail.SenderId || this.hb2detail.SenderWxid)
      if (senderId && this.contactsMap) {
        const contact = this.contactsMap[senderId]
        if (contact && contact.Avatar) return contact.Avatar
      }
      return ''
    },
    // 红包详情弹窗中的红包是否已领取（已领取则展示微信样式卡片，隐藏打开按钮）
    isHbDetailAlreadyClaimed() {
      const hb = this.hb2detail
      if (!hb) return false
      // 服务器返回的已抢列表包含当前企微号 → 已领取
      const records = (this.hbDetail && this.hbDetail.Records) || []
      const wechatId = this.currentWeChatId || hb.WxId
      if (wechatId && records.some((r) => r && r.UserName === wechatId)) return true
      // 本地领取缓存（按 MsgRemoteId / 红包 Key）
      const opened = lookupLuckMoneyOpened(this.luckMoneyMap, hb, hb._jContent)
      return !!(opened && opened.opened)
    },
    /** 传递给 ChatItem 的上下文（对齐 kelailaichatpc chatItemCtx） */
    chatItemCtx() {
      return {
        currentFriend: this.currentFriend,
        selectMode: this.selectMode,
        translations: this.translations,
        bigImageMap: this.bigImageMap,
        fallbackSenderAccount: this.fallbackSenderAccount,
        ...(this._chatItemMethods || {})
      }
    }
  }
}
