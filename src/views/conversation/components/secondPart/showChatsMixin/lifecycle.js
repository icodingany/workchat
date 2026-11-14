import { downloadFileByMsgIdTask } from '@/api/webSocketApi'
import bus from '@/utils/bus'

export default {
  created() {
    // 对齐 kelailaichatpc：本端发出 LocalSend/本地占位写入 store 后强制滚底
    this._chatStickBottomUnsub = this.$store.subscribe((mutation) => {
      if (mutation.type !== 'conversation/INSERT_LOCAL_CHAT') return
      this.$nextTick(() => {
        this.scheduleStickBottom()
      })
    })
    // 原图回包（DownloadFileResultNotice）：优先按 TaskId 匹配（避免 MsgId int64 精度丢失对不上），再按 MsgId
    this._bigImageFetchUnsub = this.$store.subscribe((mutation) => {
      if (mutation.type === 'conversation/UPDATE_CHATS_BY_DETAIL') {
        const doc = mutation.payload
        if (!doc) return
        const taskId = doc.TaskId != null ? String(doc.TaskId).trim() : ''
        const pending =
          taskId && this._pendingOriginalByTaskId
            ? this._pendingOriginalByTaskId.get(taskId)
            : null
        const key = String(this.bigImagePreviewWaitingKey || '').trim()
        const altKey = String(this.bigImagePreviewWaitingAltKey || '').trim()
        const docKey = doc.MsgId != null ? String(doc.MsgId).trim() : ''
        const matchedByMsg =
          docKey && (docKey === key || (altKey && docKey === altKey))
        const matchedByTask = !!(pending && this.bigImagePreviewVisible)
        if (!doc.Url) {
          // 拉取失败：保留缩略图预览，仅清 loading；勿关 viewer
          if (matchedByMsg || matchedByTask) {
            const err = String(doc.ErrMsg || doc.errMsg || '')
            // 手机 PickMessage 按 rid 失败时，用 lid（MsgId）再发一次（不依赖手机 APK 更新）
            // 无 Url 即失败；ErrMsg 为空时也重试（部分通道只回 Success=false）
            if (
              pending &&
              !pending.retriedLid &&
              pending.localId &&
              (!err || /消息不存在/.test(err))
            ) {
              if (taskId && this._pendingOriginalByTaskId) {
                this._pendingOriginalByTaskId.delete(taskId)
              }
              const lid = String(pending.localId)
              if (lid && lid !== String(pending.remoteId || '')) {
                const retryTaskId = downloadFileByMsgIdTask(
                  this.currentWeChatId,
                  lid,
                  lid,
                  0
                )
                if (retryTaskId && this._pendingOriginalByTaskId) {
                  this._pendingOriginalByTaskId.set(String(retryTaskId), {
                    ...pending,
                    remoteId: lid,
                    retriedLid: true,
                    at: Date.now()
                  })
                  setTimeout(() => {
                    this._pendingOriginalByTaskId &&
                      this._pendingOriginalByTaskId.delete(String(retryTaskId))
                  }, 30000)
                  return
                }
              }
            }
            if (taskId && this._pendingOriginalByTaskId) {
              this._pendingOriginalByTaskId.delete(taskId)
            }
            this.clearBigImageViewerLoadingTimer()
            this.clearBigImageViewerLoadingTip()
            this.bigImagePreviewWaitingKey = ''
            this.bigImagePreviewWaitingAltKey = ''
          }
          return
        }
        if (matchedByTask || matchedByMsg) {
          const pendingMsgKey = pending && pending.msgKey
          if (taskId && this._pendingOriginalByTaskId) {
            this._pendingOriginalByTaskId.delete(taskId)
          }
          this.$nextTick(() => {
            const url = String(doc.Url).trim()
            if (url && this.bigImagePreviewVisible) {
              // TaskId 命中时直接换图，不依赖 MsgId 是否还能对上 chats 缓存
              if (url !== this.bigImageUrl) {
                this.bigImageUrl = url
                this.updateBigImageViewerImageSrc(url)
              }
              if (pendingMsgKey) {
                this.$store.commit('conversation/UPDATE_BIG_IMAGE_MAP', {
                  msgId: pendingMsgKey,
                  url,
                  markOriginal: true
                })
              }
              this.bigImagePreviewWaitingKey = ''
              this.bigImagePreviewWaitingAltKey = ''
              this.waitingMsgId = ''
              this.clearBigImageViewerLoadingTimer()
              this.clearBigImageViewerLoadingTip()
            } else {
              this.refreshBigImageUrlIfWaiting()
            }
          })
        }
        return
      }
      if (mutation.type === 'conversation/UPDATE_BIG_IMAGE_MAP') {
        this.$nextTick(() => {
          this.onBigImageMapUpdated(mutation.payload)
        })
      }
    })
    this._chatItemMethods = {
      isSelfMsg: (chat) => this.isSelfMsg(chat),
      showMsgAvatar: (chat) => this.showMsgAvatar(chat),
      isSystemMsg: (chat) => this.isSystemMsg(chat),
      isStrangerTipChat: (chat) => this.isStrangerTipChat(chat),
      bubbleClasses: (chat) => this.bubbleClasses(chat),
      decodeChat: (chat) => this.decodeChat(chat),
      isMsgSelected: (chat) => this.isMsgSelected(chat),
      toggleSelectMsg: (chat) => this.toggleSelectMsg(chat),
      getAvatar: (chat) => this.getAvatar(chat),
      getMemberName: (chat) => this.getMemberName(chat),
      atSomebody: (chat) => this.atSomebody(chat),
      whatToDo: (chat) => this.whatToDo(chat),
      translateKey: (chat) => this.translateKey(chat),
      chatResourceFetchError: (chat) => this.chatResourceFetchError(chat),
      isSendingSpinner: (chat) => this.isSendingSpinner(chat),
      isSendFailDot: (chat) => this.isSendFailDot(chat),
      resendFailedOutgoingChat: (chat) => this.resendFailedOutgoingChat(chat),
      resolvedSenderAccountName: (chat) => this.resolvedSenderAccountName(chat),
      getSenderNickname: (name) => this.getSenderNickname(name),
      showMsgContextMenu: (e, chat) => this.showMsgContextMenu(e, chat)
    }
  },
  mounted() {
    this._boundQuoteClick = (rid) => this.handleQuoteMessageClick(rid)
    window.__handleQuoteMessageClick = this._boundQuoteClick
    this.getAccounts()
    this._onSetScrollBottom = () => {
      // rAF 合并：系统消息突发时每条消息都 emit，
      // 逐条读 scrollHeight 是强制同步布局；合并到帧内只读一次、置底一次
      if (this._scrollBottomRafId != null) return
      this._scrollBottomRafId = requestAnimationFrame(() => {
        this._scrollBottomRafId = null
        const container = document.getElementById('show-chat')
        if (!container) return
        // 收到他人消息：仅在贴底时跟随滚底（容差对齐 kelailaichatpc 的 50px）
        const nearBottom =
          !container.scrollHeight ||
          container.scrollHeight <= container.clientHeight ||
          container.scrollTop + container.clientHeight >= container.scrollHeight - 50
        if (nearBottom) {
          this.$nextTick(() => {
            this.scheduleStickBottom()
          })
        }
      })
    }
    bus.on('setScrollBottom', this._onSetScrollBottom)
    this._onManualSyncHistory = () => this.manualSyncPhoneHistory()
    bus.on('manualSyncHistory', this._onManualSyncHistory)
  },
  beforeUnmount() {
    if (window.__handleQuoteMessageClick === this._boundQuoteClick) {
      delete window.__handleQuoteMessageClick
    }
    this.clearOpenSessionHistoryTimers()
    if (typeof this._chatStickBottomUnsub === 'function') {
      this._chatStickBottomUnsub()
      this._chatStickBottomUnsub = null
    }
    if (typeof this._bigImageFetchUnsub === 'function') {
      this._bigImageFetchUnsub()
      this._bigImageFetchUnsub = null
    }
    if (this._onSetScrollBottom) {
      bus.off('setScrollBottom', this._onSetScrollBottom)
      this._onSetScrollBottom = null
    }
    if (this._scrollBottomRafId != null) {
      cancelAnimationFrame(this._scrollBottomRafId)
      this._scrollBottomRafId = null
    }
    if (this._onManualSyncHistory) {
      bus.off('manualSyncHistory', this._onManualSyncHistory)
      this._onManualSyncHistory = null
    }
    document.removeEventListener('click', this.hideMsgContextMenu)
  }
}
