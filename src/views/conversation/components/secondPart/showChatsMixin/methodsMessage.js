import { downloadFileByMsgIdTask, MsgRevokeTask, TakeLuckyMoneyTask } from '@/api/webSocketApi'
import { AddRecordRefundedTransfer } from '@/api/httpApi'
import { safeHttpUrl } from '@/utils/picturePreview'
import { generateTaskId } from '@/utils/common'
import {
  add as addPendingRefuseTask
} from '@/utils/pendingRefuseTasks'
import { addPendingTakeMoneyTask } from '@/utils/pendingTakeMoneyTasks'
import {
  canOpenHbChat,
  buildTakeLuckMoneyPayload,
  formatTransferAmount,
  isTransferClaimed,
  isTransferRefunded,
  lookupLuckMoneyOpened,
  inferRedPacketOrTransfer,
  parseHbJsonContent
} from '@/utils/takeLuckMoney'
import { msgRemoteIdMatch } from '@/utils/quoteMessage'

export default {
  methods: {
    whatToDo(chat) {
      switch (chat.ContentType) {
        case 'Voice':
        case 3:
        case 'Picture':
        case 2:
        case 'Video':
        case 4:
        case 'File':
        case 8:
          this.getChatDetail(chat)
          break
        case 'Link':
        case 6:
        case 'BizLink':
        case 18:
          this.openLink(chat)
          break
        case 'LuckyMoney':
        case 11:
        case 'MoneyTrans':
        case 12: {
          const isGroup = !!(this.currentFriend && this.currentFriend.Members)
          const kind = inferRedPacketOrTransfer(chat, isGroup)
          if (kind === 'transfer' || chat.ContentType === 'MoneyTrans' || chat.ContentType === 12) {
            this.taskTransMoney(chat)
          } else {
            const j = parseHbJsonContent(chat, isGroup)
            const opened = lookupLuckMoneyOpened(this.luckMoneyMap, chat, j)
            if (opened?.opened) {
              this.queryHbDetailTask(chat)
            } else {
              this.takeLuckMoney(chat)
            }
          }
          break
        }
        default:
          break
      }
    },
    handleQuoteMessageClick(quoteMsgRid) {
      const targetId = quoteMsgRid != null ? String(quoteMsgRid).trim() : ''
      if (!targetId) {
        this.$message.warning('未找到原始消息')
        return
      }
      const chats = this.chats || []
      const msgIndex = chats.findIndex((msg) =>
        msgRemoteIdMatch(msg.MsgRemoteId || msg.msgRemoteId, targetId)
      )
      if (msgIndex < 0) {
        this.$message.warning('原始消息未加载，请先上滑加载历史记录')
        return
      }
      this._scrollToQuotedMessage(targetId, msgIndex)
    },
    _scrollToQuotedMessage(targetId, msgIndex) {
      const container = document.getElementById('show-chat')
      if (!container) return
      const items = container.querySelectorAll('.chat-item[data-msgid]')
      let targetEl = null
      for (let i = 0; i < items.length; i++) {
        const el = items[i]
        if (msgRemoteIdMatch(el.getAttribute('data-msgid'), targetId)) {
          targetEl = el
          break
        }
      }
      if (!targetEl && items[msgIndex]) {
        targetEl = items[msgIndex]
      }
      if (!targetEl) {
        this.$message.warning('未找到原始消息')
        return
      }
      targetEl.classList.add('highlighted-message')
      setTimeout(() => targetEl.classList.remove('highlighted-message'), 3000)
      const top = targetEl.offsetTop
      const h = targetEl.offsetHeight
      const scrollTop = top - container.clientHeight / 2 + h / 2
      container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
    },
    fetchDetail(chat) {
      downloadFileByMsgIdTask(this.currentWeChatId, chat.MsgId, chat.MsgRemoteId, 0)
      this.$message({
        type: 'info',
        message: '正在从手机获取资源，请稍后再试！',
        duration: 1000
      })
    },
    getChatDetail(chat) {
      const { ContentType } = chat
      if (ContentType === 'Picture' || ContentType === 2) {
        const MsgRemoteId = chat.MsgRemoteId
        const MsgId = chat.MsgId
        const msgKey = this.chatKey(chat)
        const preview = this.resolvePicturePreviewUrl(chat)
        if (preview.url) {
          const canFetchOriginal = !!(MsgRemoteId || MsgId)
          const needFetchOriginal =
            canFetchOriginal && chat._originalImageReady !== true
          if (needFetchOriginal) {
            this.setPictureWaitingKeys(chat, msgKey)
            this.openPicturePreview(preview.url, { loading: true, msgKey })
            this.fetchOriginalImageAsync(chat, { force: true })
            return
          }
          this.openPicturePreview(preview.url, { loading: false })
          return
        }
        if (MsgRemoteId || MsgId) {
          this.setPictureWaitingKeys(chat, msgKey)
          this.bigImagePreviewWaitingKey = msgKey
          this.bigImageUrl = ''
          this.bigImagePreviewKey += 1
          this.bigImagePreviewVisible = true
          this.showBigImageViewerLoadingTip()
          this.scheduleBigImageViewerLoadingTimeout()
          this.fetchOriginalImageAsync(chat, { force: true })
          return
        }
        this.$message.warning('没有可获取的图片地址')
        return
      }
      const jContent = chat.jContent
      if (jContent && safeHttpUrl(jContent.url)) {
        const { url } = jContent
        if (ContentType === 'File') {
          this.$confirm('下载该文件?', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })
            .then(() => {
              const a = document.createElement('a')
              a.setAttribute('href', url)
              a.setAttribute('target', '_blank')
              a.setAttribute('id', 'file_a')
              if (document.getElementById('file_a')) {
                document.body.removeChild(document.getElementById('file_a'))
              }
              document.body.appendChild(a)
              a.click()
            })
            .catch(() => {})
        } else if (ContentType === 'Video' || ContentType === 4) {
          return
        } else {
          return
        }
      } else {
        this.fetchDetail(chat)
      }
    },
    openLink(chat) {
      const url = (chat.jContent && chat.jContent.url) || ''
      if (!url || !/^https?:\/\//i.test(url)) {
        this.$message.warning('链接地址无效')
        return
      }
      if (this.isDesktop && window.electronAPI) {
        window.electronAPI.shell.openExternal(url)
      } else {
        window.open(url, '_blank')
      }
    },
    revokeMessageTask(chat) {
      if (parseInt(new Date().getTime() / 1000, 10) - chat.CreateTime >= 60 * 2) {
        this.$message.warning('消息发出超过2分钟，不能撤回！')
        return
      }
      MsgRevokeTask(chat.SenderId, chat.MsgRemoteId)
    },
    atSomebody(chat) {
      const { SenderId, SenderName } = chat
      this.$store.commit('conversation/SET_REMARK', SenderId)
      this.$store.commit('conversation/SET_CONTENT', `${this.atContent}@${SenderName}\u2005`)
    },
    /** 群红包详情：本版最小实现，仅用本地已领缓存弹窗 */
    queryHbDetailTask(chat) {
      const isGroup = !!(this.currentFriend && this.currentFriend.Members)
      const jContent = parseHbJsonContent(chat, isGroup)
      if (!jContent || !jContent.Key) return
      this.hb2detail = { ...chat, _jContent: jContent }
      const openedRecord = lookupLuckMoneyOpened(this.luckMoneyMap, chat, jContent)
      if (openedRecord?.opened) {
        const wxId = this.currentWeChatId || chat.WxId
        this.$store.commit('conversation/SET_HB_DETAIL', {
          Success: true,
          WeChatId: wxId,
          HbUrl: jContent.Key,
          TotalNum: 1,
          TotalAmount: openedRecord.Amount ?? 0,
          RecNum: 1,
          RecAmount: openedRecord.Amount ?? 0,
          Records: [
            {
              UserName: wxId,
              Amount: openedRecord.Amount ?? 0,
              Time: openedRecord.RecTime ?? Date.now()
            }
          ]
        })
        this.$store.commit('conversation/SET_HB_DETAIL_VISIBLE', true)
      } else {
        this.$message({ type: 'info', message: '正在获取红包详情！', duration: 1000 })
      }
    },
    takeLuckMoney(chat) {
      const isGroup = !!(this.currentFriend && this.currentFriend.Members)
      const check = canOpenHbChat(chat, {
        wxId: this.currentWeChatId,
        isGroup,
        hbType: 'redpacket'
      })
      if (!check.ok) {
        this.$message.warning(check.error || '无法打开红包')
        return
      }
      this.hb2detail = { ...chat, _hbType: 'redpacket', _jContent: check.jContent }
      this.hbActionDialogVisible = true
    },
    async taskTransMoney(chat) {
      this.hbActionDialogVisible = false
      this.hbDetailVisible = false
      this.hb2detail = {}
      const isGroup = !!(this.currentFriend && this.currentFriend.Members)
      const check = canOpenHbChat(chat, {
        wxId: this.currentWeChatId,
        isGroup,
        hbType: 'transfer'
      })
      // 已收款/已退还可仍打开弹窗展示状态（跳过「自己发出」以外的校验）
      const jContent = parseHbJsonContent(chat, isGroup)
      if (!jContent) {
        this.$message.warning('消息格式异常')
        return
      }
      if (this.isSelfMsg(chat)) return
      const wxId = chat.WxId || this.currentWeChatId
      if (wxId) {
        try {
          await this.$store.dispatch('nedb/SyncBackendLuckMoneyRefundState', {
            wxId,
            force: true
          })
        } catch (_) {
          /* 后端未就绪时忽略 */
        }
      }
      const claimed = isTransferClaimed(chat, jContent, this.luckMoneyMap)
      const refunded = isTransferRefunded(chat, jContent, this.refundedTransferKeys, wxId)
      if (!claimed && !refunded && check.error === '该转账已经过期') {
        this.$message({ type: 'info', message: '该转账已经过期！', duration: 1000 })
        return
      }
      this.hb2detail = { ...chat, _hbType: 'transfer', _jContent: jContent }
      this.$nextTick(() => {
        this.hbActionDialogVisible = true
      })
    },
    isTransferClaimed(chat, jContent) {
      return isTransferClaimed(chat, jContent, this.luckMoneyMap)
    },
    isTransferRefunded(chat, jContent) {
      return isTransferRefunded(
        chat,
        jContent,
        this.refundedTransferKeys,
        (chat && chat.WxId) || this.currentWeChatId
      )
    },
    formatTransferAmount,
    getTransferRecTime(chat) {
      if (!chat) return null
      const rec = lookupLuckMoneyOpened(this.luckMoneyMap, chat, chat._jContent)
      return (rec && rec.RecTime) || null
    },
    formatTransferTime(createTime) {
      if (!createTime) return '-'
      const str = String(createTime)
      const ts = str.length >= 13 ? Number(createTime) : Number(createTime) * 1000
      const d = new Date(ts)
      if (Number.isNaN(d.getTime())) return '-'
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    },
    /** 红包金额展示：本地/后端 Amount 均为「分」，转元保留两位 */
    hbAmountYuan(amount) {
      const n = Number(amount)
      if (!Number.isFinite(n) || n === 0) return '0.00'
      return (n / 100).toFixed(2)
    },
    /** 红包领取记录昵称：contactsMap 命中取 Name，否则显示企微号 */
    hbRecordName(rec) {
      const wxid = rec && rec.UserName
      if (!wxid) return '未知用户'
      const contact = this.contactsMap && this.contactsMap[wxid]
      if (contact && contact.Name) return contact.Name
      return String(wxid)
    },
    /** 红包领取记录头像 */
    getRecordAvatar(wxid) {
      if (!wxid || !this.contactsMap) return ''
      const contact = this.contactsMap[wxid]
      return (contact && contact.Avatar) || ''
    },
    /** 红包领取记录时间：MM月DD日 HH:mm（兼容秒/毫秒时间戳） */
    hbRecordTime(time) {
      if (time == null || time === '') return '-'
      const str = String(time).trim()
      if (!/^\d+$/.test(str)) return '-'
      const ts = str.length >= 13 ? Number(time) : Number(time) * 1000
      const d = new Date(ts)
      if (Number.isNaN(d.getTime())) return '-'
      return `${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    doTakeLuckMoney(chat, refuse) {
      if (!chat || !chat._jContent) {
        this.$message.warning('无法操作：红包/转账数据未就绪，请重新点开消息')
        return
      }
      const isGroup = !!(this.currentFriend && this.currentFriend.Members)
      const taskId = generateTaskId()
      const { payload } = buildTakeLuckMoneyPayload(chat, {
        refuse,
        wxId: chat.WxId || this.currentWeChatId,
        isGroup,
        hbType: chat._hbType,
        taskId
      })
      if (!payload.MsgKey) {
        this.$message.warning(refuse ? '无法退还：缺少转账标识' : '无法操作：缺少消息标识')
        return
      }
      if (!payload.WxId) {
        this.$message.warning(refuse ? '无法退还：缺少企微号' : '无法操作：缺少企微号')
        return
      }
      const currentWx = this.$store.state.conversation && this.$store.state.conversation.currentWechat
      if (currentWx && Number(currentWx.isonline) === 0) {
        this.$message.warning('当前企微不在线，请先确认手机 SCRM 已连接')
        return
      }
      const label =
        chat._hbType === 'transfer' ? (refuse ? '退还' : '收款') : '开红包'
      if (refuse && chat._hbType === 'transfer') {
        this.$confirm('确定要退还该转账吗？退还后金额将退回给对方。', '退还转账', {
          confirmButtonText: '确定退还',
          cancelButtonText: '取消',
          type: 'warning'
        })
          .then(() => {
            addPendingRefuseTask(taskId, { wxId: payload.WxId, msgKey: payload.MsgKey })
            addPendingTakeMoneyTask(taskId, { label })
            console.info('[TakeLuckyMoney] send', payload)
            TakeLuckyMoneyTask(
              payload.WxId,
              payload.ConvId,
              payload.MsgRemoteId,
              payload.MsgKey,
              taskId,
              true,
              payload.ContentType
            )
            this.$message({ type: 'info', message: '已提交退还，等待手机执行…', duration: 2000 })
            this.hbActionDialogVisible = false
            this.hb2detail = {}
            this.$store.commit('nedb/ADD_REFUNDED_TRANSFER', {
              wxId: payload.WxId,
              msgKey: payload.MsgKey
            })
            AddRecordRefundedTransfer(payload.WxId, payload.MsgKey).catch(() => {})
            this.$store.dispatch('nedb/InsertLuckMoney', {
              WxId: payload.WxId,
              WeChatId: payload.WxId,
              ConvId: payload.ConvId,
              MsgRemoteId: payload.MsgRemoteId,
              MsgKey: payload.MsgKey
            })
          })
          .catch(() => {})
      } else {
        addPendingTakeMoneyTask(taskId, { label })
        console.info('[TakeLuckyMoney] send', payload)
        TakeLuckyMoneyTask(
          payload.WxId,
          payload.ConvId,
          payload.MsgRemoteId,
          payload.MsgKey,
          taskId,
          !!refuse,
          payload.ContentType
        )
        this.$message({
          type: 'info',
          message: chat._hbType === 'transfer' ? '已提交收款，等待手机执行…' : '已提交开红包，等待手机执行…',
          duration: 2000
        })
        this.$store.dispatch('nedb/InsertLuckMoney', {
          WxId: payload.WxId,
          WeChatId: payload.WxId,
          ConvId: payload.ConvId,
          MsgRemoteId: payload.MsgRemoteId,
          MsgKey: payload.MsgKey
        })
        this.hbActionDialogVisible = false
        this.hb2detail = {}
      }
    }
  }
}
