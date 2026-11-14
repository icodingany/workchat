import { downloadFileByMsgIdTask } from '@/api/webSocketApi'
import {
  resolvePictureUrl as _resolvePictureUrl,
  resolvePicturePreviewUrl as _resolvePicturePreviewUrl,
  normalizePictureUrl,
  safeHttpUrl
} from '@/utils/picturePreview'
import { isContentType, isResolvableEmptyMedia } from '@/utils/chatMessageFields'

export default {
  methods: {
    openPicturePreview(url, options = {}) {
      const { loading = false, msgKey = '' } = options
      const normalized = normalizePictureUrl(url)
      if (!normalized) return
      this.bigImagePreviewWaitingKey = loading ? String(msgKey || '') : ''
      this.bigImageUrl = normalized
      this.bigImagePreviewKey += 1
      this.bigImagePreviewVisible = true
      this._bigImagePreviewIgnoreCloseUntil = Date.now() + 400
      if (loading) {
        this.$nextTick(() => {
          setTimeout(() => {
            if (this.bigImagePreviewWaitingKey || this.bigImagePreviewWaitingAltKey) {
              this.showBigImageViewerLoadingTip()
              this.scheduleBigImageViewerLoadingTimeout()
            }
            this.patchBigImageViewerImg(normalized)
          }, 80)
        })
      } else {
        this.clearBigImageViewerLoadingTimer()
        this.clearBigImageViewerLoadingTip()
        this.$nextTick(() => {
          setTimeout(() => this.patchBigImageViewerImg(normalized), 80)
        })
      }
    },
    closeBigImagePreview() {
if (this._bigImagePreviewIgnoreCloseUntil && Date.now() < this._bigImagePreviewIgnoreCloseUntil) {
        return
      }
      this._bigImagePreviewIgnoreCloseUntil = 0
      this.bigImagePreviewVisible = false
      this.bigImagePreviewWaitingKey = ''
      this.bigImagePreviewWaitingAltKey = ''
      this.waitingMsgId = ''
      this.waitingContentType = null
      this.clearBigImageViewerLoadingTimer()
      this.clearBigImageViewerLoadingTip()
    },
    updateBigImageViewerImageSrc(url) {
const normalized = normalizePictureUrl(url)
      if (!normalized) return
      this.patchBigImageViewerImg(normalized)
    },
    patchBigImageViewerImg(url) {
const tryPatch = (attempt = 0) => {
        const img = document.querySelector('.el-image-viewer__img')
        if (!img) {
          if (attempt < 24) setTimeout(() => tryPatch(attempt + 1), 50)
          return
        }
        img.referrerPolicy = 'no-referrer'
        if (url && img.src !== url) {
          img.src = url
        }
      }
      tryPatch()
    },
    showBigImageViewerLoadingTip() {
this.$nextTick(() => {
        const tryInject = (attempt = 0) => {
          const wrapper = document.querySelector('.el-image-viewer__wrapper')
          if (!wrapper) {
            if (attempt < 24) setTimeout(() => tryInject(attempt + 1), 50)
            return
          }
          this.clearBigImageViewerLoadingTip()
          const tip = document.createElement('div')
          tip.className = 'big-image-viewer-loading-tip'
          tip.innerHTML = '<i class="el-icon-loading"></i><span>正在加载原图...</span>'
          const actions =
            wrapper.querySelector('.el-image-viewer__actions') ||
            wrapper.querySelector('.el-image-viewer__btn')
          if (actions && actions.parentNode) {
            actions.parentNode.insertBefore(tip, actions)
          } else {
            wrapper.appendChild(tip)
          }
        }
        tryInject()
      })
    },
    clearBigImageViewerLoadingTip() {
document.querySelectorAll('.big-image-viewer-loading-tip').forEach((el) => el.remove())
    },
    clearBigImageViewerLoadingTimer() {
if (this.bigImagePreviewOriginalLoadingTimer) {
        clearTimeout(this.bigImagePreviewOriginalLoadingTimer)
        this.bigImagePreviewOriginalLoadingTimer = null
      }
    },
    scheduleBigImageViewerLoadingTimeout(timeout = 15000) {
this.clearBigImageViewerLoadingTimer()
      this.bigImagePreviewOriginalLoadingTimer = setTimeout(() => {
        this.bigImagePreviewOriginalLoadingTimer = null
        this.bigImagePreviewWaitingKey = ''
        this.bigImagePreviewWaitingAltKey = ''
        this.clearBigImageViewerLoadingTip()
      }, timeout)
    },
    setPictureWaitingKeys(chat, msgKey) {
const MsgId = chat && chat.MsgId
      const MsgRemoteId = chat && chat.MsgRemoteId
      this.waitingMsgId = msgKey
      this.waitingContentType = chat && chat.ContentType
      this.bigImagePreviewWaitingAltKey =
        MsgId != null &&
        MsgId !== '' &&
        MsgRemoteId != null &&
        MsgRemoteId !== '' &&
        String(MsgId) !== String(MsgRemoteId)
          ? String(msgKey) === String(MsgId)
            ? String(MsgRemoteId)
            : String(MsgId)
          : ''
    },
    onBigImageMapUpdated(payload) {
if (!payload || !payload.url) return
      const key = String(payload.msgId || '')
      const waiting =
        key &&
        (key === String(this.bigImagePreviewWaitingKey) ||
          key === String(this.bigImagePreviewWaitingAltKey) ||
          key === String(this.waitingMsgId))
      if (!waiting || !this.bigImagePreviewVisible) return
      const url = safeHttpUrl(payload.url)
      if (!url || url === this.bigImageUrl) return
      this.bigImageUrl = url
      this.updateBigImageViewerImageSrc(url)
      this.bigImagePreviewWaitingKey = ''
      this.bigImagePreviewWaitingAltKey = ''
      this.waitingMsgId = ''
      this.clearBigImageViewerLoadingTimer()
      this.clearBigImageViewerLoadingTip()
    },
    refreshBigImageUrlIfWaiting() {
if (!this.bigImagePreviewVisible || !this.bigImagePreviewWaitingKey) return
      let target = null
      const key = String(this.bigImagePreviewWaitingKey)
      const altKey = String(this.bigImagePreviewWaitingAltKey || '')
      for (const c of this.chats) {
        const k = this.chatKey(c)
        if (k === key || (altKey && k === altKey)) {
          target = c
          break
        }
      }
      const pic = target ? this.resolvePicturePreviewUrl(target) : null
      const url = pic && pic.isOriginal ? pic.url : ''
      if (url && url !== this.bigImageUrl) {
        this.bigImageUrl = url
        this.updateBigImageViewerImageSrc(url)
      }
      this.bigImagePreviewWaitingKey = ''
      this.bigImagePreviewWaitingAltKey = ''
      this.waitingMsgId = ''
      this.clearBigImageViewerLoadingTimer()
      this.clearBigImageViewerLoadingTip()
    },
    fetchOriginalImageAsync(chat, options = {}) {
      if (!chat) return
      const force = options.force === true
      const preview = this.resolvePicturePreviewUrl(chat)
      if (!force && preview.isOriginal) return
      const msgKey = this.chatKey(chat)
      if (!msgKey) return
      if (!this._pictureOriginalUpgradeQueuedKeys) {
        this._pictureOriginalUpgradeQueuedKeys = new Set()
      }
      if (!force && this._pictureOriginalUpgradeQueuedKeys.has(msgKey)) return
      this._pictureOriginalUpgradeQueuedKeys.add(msgKey)
      // 手机按 MsgRemoteId(rid) 查消息；缺省用 MsgId(lid)。一律 String，防 int64 精度丢失
      const remoteId =
        chat.MsgRemoteId != null && String(chat.MsgRemoteId).trim() !== ''
          ? String(chat.MsgRemoteId)
          : String(chat.MsgId || '')
      const localId = chat.MsgId != null ? String(chat.MsgId) : remoteId
      const taskId = downloadFileByMsgIdTask(
        this.currentWeChatId,
        localId,
        remoteId,
        0
      )
      if (!this._pendingOriginalByTaskId) {
        this._pendingOriginalByTaskId = new Map()
      }
      if (taskId) {
        this._pendingOriginalByTaskId.set(String(taskId), {
          msgKey,
          altKey: String(this.bigImagePreviewWaitingAltKey || ''),
          localId,
          remoteId,
          retriedLid: false,
          at: Date.now()
        })
      }
      setTimeout(() => {
        this._pictureOriginalUpgradeQueuedKeys &&
          this._pictureOriginalUpgradeQueuedKeys.delete(msgKey)
      }, 30000)
    },
    prefetchRecentPictureResources(maxCount = 10) {
const chats = this.chats || []
      if (!chats.length) return
      const limit = Math.max(1, Number(maxCount) || 10)
      const recentPictures = []
      for (let i = chats.length - 1; i >= 0 && recentPictures.length < limit; i--) {
        const chat = chats[i]
        const ct = chat && chat.ContentType
        if (!(ct === 'Picture' || ct === 2 || ct === '2')) continue
        const preview = this.resolvePicturePreviewUrl(chat)
        if (preview.isOriginal) continue
        if (preview.url || isResolvableEmptyMedia(chat)) {
          recentPictures.push(chat)
        }
      }
      recentPictures.forEach((chat) => this.fetchOriginalImageAsync(chat))
    }
  }
}
