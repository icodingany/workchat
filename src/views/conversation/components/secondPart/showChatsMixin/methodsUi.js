import errorImg from '@/assets/svg/conversation-image-error.svg'
import { TalkToFriendTask } from '@/api/webSocketApi'
import { queryAccountsByCid } from '@/api/httpApiAdmin'
import { isSendFailedChat, isLocalSendingChat } from '@/utils/localSendPreview'
import { isStrangerContactDigest } from '@/utils/conversationSort'
import { STRANGER_TIP_MSG_ID_PREFIX } from '@/utils/openSessionHistory'
import { decodeChatHtml } from '@/utils/decodeChatHtml'
import { decodeMsgContent } from '@/utils/downloadFileDetail'
import { resolveOutgoingResendContent } from '@/utils/outgoingResendContent'
import { sameWxId } from '@/utils/wechat'
import {
  resolvePictureUrl as _resolvePictureUrl,
  resolvePicturePreviewUrl as _resolvePicturePreviewUrl,
  pictureMsgKey
} from '@/utils/picturePreview'
import { isContentType } from '@/utils/chatMessageFields'
import { chatContentClasses, isHiddenAvatarContentType } from '@/utils/chatContentClasses'

export default {
  methods: {
    isSelfMsg(chat) {
return sameWxId(chat && chat.SenderId, this.currentWeChatId)
    },
    showMsgAvatar(chat) {
return !isHiddenAvatarContentType(chat && chat.ContentType)
    },
    isSystemMsg(chat) {
return isHiddenAvatarContentType(chat && chat.ContentType)
    },
    bubbleClasses(chat) {
return chatContentClasses(chat && chat.ContentType)
    },
    isStrangerTipChat(chat) {
if (!chat) return false
      if (chat._strangerTip) return true
      const id = chat.MsgId != null ? String(chat.MsgId) : ''
      if (id.startsWith(STRANGER_TIP_MSG_ID_PREFIX)) return true
      const ct = chat.ContentType
      if (ct !== 'System' && ct !== 5) return false
      return isStrangerContactDigest(chat.Content)
    },
    isSendingSpinner(chat) {
      // 图片/视频/表情与文本一致：LocalSend 期间显示转圈（8s 后 PendingSync 释放）
      return isLocalSendingChat(chat)
    },
    isSendFailDot(chat) {
return isSendFailedChat(chat)
    },
    resendFailedOutgoingChat(chat) {
if (!chat || !isSendFailedChat(chat) || !this.isSelfMsg(chat)) return
      if (this.isSystemMsg(chat)) {
        this.$message.warning('该类型消息不支持重新发送')
        return
      }
      const wxId = String(chat.WxId || this.currentWeChatId || '').trim()
      const convId = String(chat.ConvId || this.currentFriendId || '').trim()
      if (!wxId || !convId) {
        this.$message.warning('无法重发：会话信息不完整')
        return
      }
      let content = decodeMsgContent(chat.Content)
      if (content == null) content = ''
      if (typeof content !== 'string') content = String(content)
      const mediaTypes = ['Picture', 'Voice', 'Video', 'File', 2, 3, 4, 8]
      const ct = chat.ContentType
      // 本地占位 Picture/Video 是 JSON，重发须还原为纯 URL，否则手机 download failed
      content = resolveOutgoingResendContent(ct, content)
      const isMedia = mediaTypes.indexOf(ct) >= 0 || mediaTypes.indexOf(Number(ct)) >= 0
      if (isMedia && !String(content).trim()) {
        this.$message.warning('无法重发：缺少消息内容')
        return
      }
      const refId = chat.RefId || ''
      const at = chat.AtSomeOne || ''
      // 重发复用原 TaskId：服务端按 (wxId, taskId) 发送幂等去重——在途重发不下发手机，
      // 已成功重发回放首次结果；已失败重发由服务端放行为真正重试（2026-09-04 竞态协作协议）
      const sent = TalkToFriendTask(wxId, convId, ct, content, refId, at, chat.TaskId)
      if (!sent) {
        this.$message.warning('WebSocket 未连接，发送失败，请刷新页面或重新登录')
        return
      }
      this.$store.dispatch('conversation/RemoveLocalChat', {
        WxId: wxId,
        ConvId: convId,
        TaskId: chat.TaskId
      })
    },
    getAccounts() {
queryAccountsByCid()
        .then((res) => {
          if (res && res.code === 0) {
            this.accountList = res.data || []
          }
        })
        .catch(() => {})
    },
    getSenderNickname(accountName) {
if (!accountName || !Array.isArray(this.accountList)) return ''
      const item = this.accountList.find((acc) => acc && acc.account === accountName)
      if (!item) return ''
      return item.nickname || item.NickName || ''
    },
    resolvedSenderAccountName(chat) {
const name = chat && chat.SenderAccountName
      if (name != null && String(name).trim()) return String(name).trim()
      if (
        chat &&
        this.isSelfMsg(chat) &&
        (chat.LocalSend || chat.PendingSync || (!chat.MsgId && !chat.MsgRemoteId))
      ) {
        return this.fallbackSenderAccount
      }
      return ''
    },
    getMemberName(chat) {
if (chat && chat.SenderName && String(chat.SenderName).trim()) {
        return chat.SenderName
      }
      const sid = chat && chat.SenderId
      const member = sid != null ? this.membersMap[sid] || this.membersMap[String(sid)] : null
      if (member) {
        return member.Alias || member.Name || member.Nickname || member.NickName || String(sid)
      }
      const contact = sid != null ? this.contactsMap[sid] || this.contactsMap[String(sid)] : null
      if (contact) {
        return contact.Alias || contact.Name || contact.Nickname || contact.NickName || String(sid)
      }
      return sid != null ? String(sid) : ''
    },
    getAvatar(chat) {
let sid = chat.SenderId
      // 自己发的消息
      if (this.isSelfMsg(chat)) {
        return this.currentWechat.Avatar
      } else {
        // 如果是群好友发的
        if (this.currentFriend.Members) {
          if (this.membersMap[sid]) {
            return this.membersMap[sid].Avatar || errorImg
          } else if (this.contactsMap[sid]) {
            return this.contactsMap[sid].Avatar || errorImg
          } else {
            return errorImg
          }
        } else {
          return this.currentFriend.Avatar || errorImg
        }
      }
    },
    decodeChat(chat) {
      const ct = chat && (chat.ContentType ?? chat.contentType)
      const isQuote = ct === 'QuoteMsg' || ct === 22
      return decodeChatHtml(chat, {
        contactsMap: this.contactsMap,
        luckMoneyMap: this.luckMoneyMap,
        refundedTransferKeys: this.refundedTransferKeys,
        currentWxId: this.currentWeChatId,
        isSelfMsg: (c) => this.isSelfMsg(c),
        friendNick: (this.currentFriend && this.currentFriend.FriendNick) || '对方',
        pictureOnerror: true,
        currentChats: this.chats,
        useCache: !isQuote
      })
    },
    chatKey(chat) {
return pictureMsgKey(chat)
    },
    resolvePictureUrl(chat) {
return _resolvePictureUrl(chat)
    },
    resolvePicturePreviewUrl(chat) {
return _resolvePicturePreviewUrl(chat, this.bigImageMap || {})
    }
  }
}
