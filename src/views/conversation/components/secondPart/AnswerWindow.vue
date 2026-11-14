<template>
  <div class="anwser-window">
    <div v-if="quoteMsg" class="quote-bar">
      <span class="quote-bar-text">引用：{{ quotePreview }}</span>
      <i class="el-icon-close quote-bar-close" @click="$store.commit('conversation/CLEAR_QUOTE_MSG')"></i>
    </div>
  <div class="scroll show-content" @dragover.prevent="handleDragOver" @drop.prevent.stop="handleDrop">
      <div v-if="contentType === 'Text' || !contentType" class="composer-text-wrap">
        <div
          v-if="pendingImages.length"
          ref="dropImgsBox"
          class="dropImgs-box composer-pending-strip"
          tabindex="0"
          @click="focusDropImgsBox"
          @keydown.stop="onDropImgsKeydown"
        >
          <div
            v-for="(image, index) in pendingImages"
            :key="index"
            class="pending-img-item"
            :class="{ 'is-selected': pendingImageSelectedIndex === index }"
            @click.stop="selectPendingImage(index)"
          >
            <img
              :src="pendingImageDisplaySrc(image)"
              alt=""
              referrerpolicy="no-referrer"
            />
            <i
              class="el-icon-close pending-img-remove"
              title="删除"
              @click.stop="removePendingImage(index)"
            ></i>
          </div>
        </div>
        <div v-if="pendingFiles.length" class="file-list composer-pending-strip">
          <div v-for="(file, index) in pendingFiles" :key="'f-' + index" class="file-item">
            <i class="el-icon-document"></i>
            <span class="file-name">{{ file.name }}</span>
            <i class="el-icon-close pending-file-remove" @click.stop="removePendingFile(index)"></i>
          </div>
        </div>
        <textarea
          ref="anwserText"
          class="scroll show-content-textarea composer-textarea"
          id="textarea"
          maxlength="1000"
          autofocus
          v-model="composerText"
          @compositionstart="isComposing = true"
          @compositionend="handleCompositionEnd"
          @keydown="onComposerTextKeydown"
          @paste.prevent="handlePaste"
          @dragover.prevent="handleDragOver"
          @drop.prevent.stop="handleDrop"
        ></textarea>
      </div>
      <img v-else-if="contentType === 'Picture'" class="show-content-img" :src="content" alt="图片丢失" />
      <video v-else-if="contentType === 'Video'" class="show-content-video" :src="content" controls></video>
      <audio
        v-else-if="contentType === 'Voice' && /.mp3$/.test(content)"
        class="show-content-voice"
        :src="content"
        type="audio/mp3"
        controls
      ></audio>
      <span
        v-else-if="contentType === 'Voice'"
        class="show-content-file"
        v-text="content"
      ></span>
      <span
        v-else-if="contentType === 'File'"
        class="show-content-file"
        v-text="$filters.getFileName(content)"
      ></span>
    </div>

    <div class="opration-btn">
      <div class="chats-bottom">
        Shift + Enter 换行 · Enter 发送
        <span v-if="contentType === 'Text'" class="composer-hint"> · 支持粘贴图片</span>
      </div>
      <div>
        <el-button class type="warning" @click="clearContent">清空</el-button>
        <el-button class type="primary" @click="talkToFriendTask">发送(Enter)</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { throttle } from 'lodash'
import { ElMessage } from 'element-plus'
import { TalkToFriendTask } from '@/api/webSocketApi'
import { fileUpload, getFileUploadErrorMsg, isFileUploadOk } from '@/utils/upload'
import { toHttpForWechatCdn } from '@/utils/emojiPayload'
import {
  collectClipboardImageFiles,
  createPendingImageEntry,
  fileHasImageMagic,
  isImageFileLike,
  pendingImageSendUrl,
  reencodeClipboardImageFiles,
  revokePendingImagePreview
} from './answerWindowPaste'

export default {
  data() {
    return {
      isComposing: false,
      pendingImages: [],
      pendingFiles: [],
      pendingImageSelectedIndex: null
    }
  },
  computed: {
    ...mapGetters({
      remark: 'conversation/remark',
      content: 'conversation/content',
      contentType: 'conversation/contentType',
      currentFriend: 'conversation/currentFriend',
      quoteMsg: 'conversation/quoteMsg'
    }),
    quotePreview() {
      const q = this.quoteMsg
      if (!q) return ''
      const t = q.ContentType
      if (t === 'Text' || t === 1) {
        const s = String(q.Content || '')
        return s.length > 40 ? s.slice(0, 40) + '…' : s
      }
      if (t === 'Picture' || t === 2) return '[图片]'
      if (t === 'Video' || t === 4) return '[视频]'
      if (t === 'Link' || t === 6) return '[链接]'
      if (t === 'File' || t === 8) return '[文件]'
      return '[消息]'
    },
    membersMap() {
      if (this.currentFriend.Members) {
        return this.currentFriend.Members.map((x) => {
          return x.RemoteId || x.OpRemoteId
        })
      }
      return []
    },
    /** 与 Vuex content 双向绑定；话术/素材写入 store 后输入框能同步回显 */
    composerText: {
      get() {
        return this.content || ''
      },
      set(val) {
        this.$store.commit('conversation/SET_CONTENT', val != null ? val : '')
      }
    }
  },
  watch: {
    content() {
      this.syncComposerTextareaDom()
    },
    contentType() {
      this.syncComposerTextareaDom()
    }
  },
  methods: {
    syncComposerTextareaDom() {
      this.$nextTick(() => {
        const textarea = this.$refs.anwserText
        if (!textarea || this.contentType !== 'Text' && this.contentType) return
        const next = this.content || ''
        if (textarea.value !== next) {
          textarea.value = next
        }
      })
    },
    isComposerVideoFile(file) {
      if (!file) return false
      const mime = file.type && String(file.type)
      if (mime && mime.startsWith('video/')) return true
      const name = String(file.name || '').toLowerCase()
      return name.endsWith('.mp4') || name.endsWith('.mov')
    },
    pendingImageDisplaySrc(image) {
      if (image && typeof image === 'object' && image.preview) return image.preview
      const url = pendingImageSendUrl(image)
      return toHttpForWechatCdn(url) || url
    },
    focusDropImgsBox() {
      this.$refs.dropImgsBox && this.$refs.dropImgsBox.focus()
    },
    selectPendingImage(index) {
      this.pendingImageSelectedIndex = index
      this.focusDropImgsBox()
    },
    ensureComposerForPendingImages() {
      if (this.contentType !== 'Text') {
        this.$store.commit('conversation/SET_CONTENT', '')
        this.$store.commit('conversation/SET_CONTENT_TYPE', 'Text')
      }
    },
    async mapWithConcurrency(items, limit, mapper) {
      if (!items.length) return []
      const results = new Array(items.length)
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < items.length) {
          const i = nextIndex++
          results[i] = await mapper(items[i], i)
        }
      }
      const workers = Math.min(limit, items.length)
      await Promise.all(Array.from({ length: workers }, () => worker()))
      return results
    },
    async uploadFiles(files, targetArray, errorMsg, includeMetadata = false) {
      const PASTE_UPLOAD_CONCURRENCY = 3
      const uploadList = includeMetadata ? files : await reencodeClipboardImageFiles(files)
      const results = await this.mapWithConcurrency(uploadList, PASTE_UPLOAD_CONCURRENCY, async (file) => {
        if (!file || !(file.size > 0)) {
          return { ok: false, errMsg: '文件内容为空，请重新选择或拖入图片' }
        }
        if (!includeMetadata && !(await fileHasImageMagic(file))) {
          return { ok: false, errMsg: '图片文件无效或已损坏，请重新拖入或从文件夹选择' }
        }
        const formdata = new FormData()
        formdata.append('myfile', file)
        try {
          const res = await fileUpload(formdata)
          if (!isFileUploadOk(res)) {
            return { ok: false, errMsg: getFileUploadErrorMsg(res) }
          }
          return {
            ok: true,
            url: res.data.url,
            name: file.name,
            file,
            isVideo: includeMetadata ? this.isComposerVideoFile(file) : undefined
          }
        } catch (error) {
          return { ok: false }
        }
      })
      let hasFailure = false
      for (const item of results) {
        if (item.ok) {
          this.ensureComposerForPendingImages()
          if (includeMetadata) {
            targetArray.push({
              url: item.url,
              name: item.name,
              isVideo: item.isVideo
            })
          } else {
            targetArray.push(createPendingImageEntry(item.url, item.file))
          }
        } else {
          hasFailure = true
        }
      }
      if (hasFailure) {
        const detail = results.find((item) => item && item.errMsg)?.errMsg
        ElMessage.error(detail || errorMsg)
      }
    },
    async uploadPastedImages(files) {
      await this.uploadFiles(files, this.pendingImages, '部分图片上传失败', false)
      this.afterPendingImagesChanged()
    },
    async uploadPastedFiles(files) {
      await this.uploadFiles(files, this.pendingFiles, '部分文件上传失败', true)
    },
    afterPendingImagesChanged() {
      this.$nextTick(() => {
        this.pendingImageSelectedIndex =
          this.pendingImages.length > 0 ? this.pendingImages.length - 1 : null
        this.focusDropImgsBox()
      })
    },
    revokeAllPendingImagePreviews() {
      ;(this.pendingImages || []).forEach((item) => revokePendingImagePreview(item))
    },
    clearPendingImages() {
      this.revokeAllPendingImagePreviews()
      this.pendingImages = []
      this.pendingImageSelectedIndex = null
    },
    removePendingImage(index) {
      if (index < 0 || index >= this.pendingImages.length) return
      const [removed] = this.pendingImages.splice(index, 1)
      revokePendingImagePreview(removed)
      if (this.pendingImageSelectedIndex === index) {
        this.pendingImageSelectedIndex = null
      } else if (this.pendingImageSelectedIndex != null && this.pendingImageSelectedIndex > index) {
        this.pendingImageSelectedIndex--
      }
      if (this.pendingImages.length === 0) {
        this.pendingImageSelectedIndex = null
        this.$nextTick(() => this.$refs.anwserText?.focus())
      }
    },
    removePendingFile(index) {
      if (index < 0 || index >= this.pendingFiles.length) return
      this.pendingFiles.splice(index, 1)
    },
    extractImageFilesFromClipboardData(clipboardData) {
      return collectClipboardImageFiles(clipboardData)
    },
    extractNonImageFilesFromClipboardData(clipboardData) {
      if (!clipboardData) return []
      const files = []
      const items = Array.from(clipboardData.items || [])
      items.forEach((item) => {
        if (!item || item.kind !== 'file') return
        const file = typeof item.getAsFile === 'function' ? item.getAsFile() : null
        if (file && !isImageFileLike(file)) files.push(file)
      })
      if (files.length > 0) return files
      return Array.from(clipboardData.files || []).filter((f) => f && !isImageFileLike(f))
    },
    async readWebClipboardImageFiles() {
      if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
        return []
      }
      try {
        const items = await navigator.clipboard.read()
        const files = []
        for (const item of items || []) {
          const types = (item && item.types) || []
          const imageType = types.find((t) => String(t).startsWith('image/'))
          if (!imageType || typeof item.getType !== 'function') continue
          try {
            const blob = await item.getType(imageType)
            if (!blob || !(blob.size > 0)) continue
            const ext = String(imageType).split('/')[1] || 'png'
            files.push(
              new File([blob], `paste-${Date.now()}.${ext}`, {
                type: blob.type || imageType
              })
            )
          } catch (_) {
            /* ignore */
          }
        }
        return files
      } catch (_) {
        return []
      }
    },
    async handlePaste(event) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault()
        event.stopPropagation()
      }
      const data = event.clipboardData
      let imageFiles = this.extractImageFilesFromClipboardData(data).filter((f) => f && f.size > 0)
      const textPlain = data ? data.getData('text/plain') || '' : ''

      const tryUploadImages = async (files) => {
        if (!files || !files.length) return false
        const before = this.pendingImages.length
        await this.uploadPastedImages(files)
        return this.pendingImages.length > before
      }

      let uploaded = false
      if (imageFiles.length) {
        uploaded = await tryUploadImages(imageFiles)
      }
      if (!uploaded) {
        imageFiles = await this.readWebClipboardImageFiles()
        uploaded = await tryUploadImages(imageFiles)
      }
      if (uploaded) return

      const nonImageFiles = this.extractNonImageFilesFromClipboardData(data)
      if (nonImageFiles.length > 0) {
        await this.uploadPastedFiles(nonImageFiles)
        return
      }
      if (textPlain) {
        this.insertTextAtComposerCaret(textPlain)
      }
    },
    handleDragOver(e) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    },
    async handleDrop(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
      if (e && typeof e.preventDefault === 'function') e.preventDefault()
      const dt = e.dataTransfer
      const allFiles = Array.from((dt && dt.files) || [])
      const images = allFiles.filter((f) => f && isImageFileLike(f) && f.size > 0)
      const others = allFiles.filter((f) => f && !isImageFileLike(f) && f.size > 0)
      if (!images.length && !others.length) {
        ElMessage.warning('未能读取图片，请从文件夹选择或重新拖入')
        return
      }
      if (images.length) await this.uploadPastedImages(images)
      if (others.length) await this.uploadPastedFiles(others)
    },
    insertTextAtComposerCaret(text) {
      if (text == null || text === '') return
      const textarea = this.$refs.anwserText
      if (!textarea) {
        this.$store.commit('conversation/SET_CONTENT_TYPE', 'Text')
        this.$store.commit('conversation/SET_CONTENT', (this.content || '') + text)
        return
      }
      const start =
        textarea.selectionStart != null ? textarea.selectionStart : (this.content || '').length
      const end = textarea.selectionEnd != null ? textarea.selectionEnd : start
      const current = this.content || ''
      const newContent = `${current.slice(0, start)}${text}${current.slice(end)}`
      this.$store.commit('conversation/SET_CONTENT_TYPE', 'Text')
      this.$store.commit('conversation/SET_CONTENT', newContent)
      const pos = start + text.length
      this.$nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(pos, pos)
      })
    },
    onDropImgsKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault()
        this.talkToFriendTask()
        return
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      e.preventDefault()
      e.stopPropagation()
      if (!this.pendingImages.length) return
      const idx =
        this.pendingImageSelectedIndex != null &&
        this.pendingImageSelectedIndex < this.pendingImages.length
          ? this.pendingImageSelectedIndex
          : this.pendingImages.length - 1
      this.removePendingImage(idx)
    },
  talkToFriendTask() {
      const { WxId, RemoteId } = this.currentFriend
      if (!WxId || !RemoteId) {
        this.$message.warning('好友数据不对，不能发送消息！')
        return
      }

      const textTrim = (this.content || '').replace(/\s/gi, '')
      const hasPendingImages = this.pendingImages.length > 0
      const hasPendingFiles = this.pendingFiles.length > 0

      if (this.contentType === 'Text' || !this.contentType) {
        if (!textTrim && !hasPendingImages && !hasPendingFiles) {
          this.$message.warning('请设置发送内容！')
          return
        }
      } else if (!textTrim) {
        this.$message.warning('请设置发送内容！')
        return
      }

      const sendBatch = () => {
        if (this.contentType === 'Text' || !this.contentType) {
          if (textTrim) {
            const sent = this.dispatchTalk(
              WxId,
              RemoteId,
              this.quoteMsg ? undefined : 'Text',
              this.content
            )
            if (sent === false) return false
          }
          if (hasPendingImages) {
            for (const img of this.pendingImages) {
              const sent = this.dispatchTalk(WxId, RemoteId, 'Picture', pendingImageSendUrl(img))
              if (sent === false) return false
            }
          }
          if (hasPendingFiles) {
            for (const file of this.pendingFiles) {
              let sent
              if (file.isVideo) {
                sent = this.dispatchTalk(WxId, RemoteId, 'Video', file.url)
              } else {
                const payload = JSON.stringify({ name: file.name, url: file.url })
                sent = this.dispatchTalk(WxId, RemoteId, 'File', payload)
              }
              if (sent === false) return false
            }
          }
          this.clearPendingImages()
          this.pendingFiles = []
          this.clearContent()
          return true
        }

        const sent = this.dispatchTalk(WxId, RemoteId)
        if (sent === false) {
          this.$message.warning('WebSocket 未连接，发送失败，请刷新页面或重新登录')
          return false
        }
        this.clearContent()
        return true
      }

      if (this.currentFriend.Members) {
        if (this.membersMap.indexOf(WxId) < 0) {
          this.$message.warning('你已被踢出群聊,不能在该群发送消息!')
          return
        }
      }

      if (!sendBatch()) {
        this.$message.warning('WebSocket 未连接，发送失败，请刷新页面或重新登录')
      }
    },
    dispatchTalk(WxId, RemoteId, typeOverride, contentOverride) {
      const refId = this.quoteMsg ? this.quoteMsg.MsgRemoteId || '' : ''
      const type = typeOverride || (refId ? 'QuoteMsg' : this.contentType)
      const content = contentOverride != null ? contentOverride : this.content
      const at = this.remark
      const sent = TalkToFriendTask(WxId, RemoteId, type, content, refId, at)
      if (sent !== false && refId) {
        this.$store.commit('conversation/CLEAR_QUOTE_MSG')
      }
      return sent
    },
    lineFeed() {
      const textarea = this.$refs.anwserText
      if (!textarea) return
      const start = textarea.selectionStart
      let newContent = this.content.slice(0, start) + '\r\n' + this.content.slice(textarea.selectionEnd)
      this.$store.commit('conversation/SET_CONTENT', newContent)
      this.$nextTick(() => {
        const pos = start + 2
        textarea.focus()
        textarea.setSelectionRange(pos, pos)
      })
    },
    onComposerTextKeydown(e) {
      if (e.key === 'Enter' && e.shiftKey) {
        this.lineFeed(e)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        if (this.isComposing) return
        e.preventDefault()
        this.talkToFriendTask()
        return
      }
      if (e.key === 'Backspace' && this.pendingImages.length > 0) {
        const textarea = this.$refs.anwserText
        const atStart = textarea && textarea.selectionStart === 0 && textarea.selectionEnd === 0
        const emptyText = !(this.content || '').trim()
        if (atStart && emptyText) {
          e.preventDefault()
          this.removePendingImage(this.pendingImages.length - 1)
        }
      }
    },
    handleCompositionEnd(event) {
      this.isComposing = false
      this.composerText = event.target.value
    },
    clearContent() {
      this.isComposing = false
      this.clearPendingImages()
      this.pendingFiles = []
      this.$store.commit('conversation/SET_REMARK', '')
      this.$store.commit('conversation/SET_CONTENT', '')
      this.$store.commit('conversation/SET_CONTENT_TYPE', 'Text')
      this.syncComposerTextareaDom()
    }
  },
  created() {
    this.talkToFriendTask = throttle(this.talkToFriendTask, 200, { leading: true, trailing: false })
  },
  beforeUnmount() {
    this.revokeAllPendingImagePreviews()
  }
}
</script>

<style lang="scss" scoped>
.anwser-window {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  background-color: $bg-color-content-base;
  overflow: hidden;

  .quote-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 4px 6px 0;
    padding: 6px 8px;
    font-size: 12px;
    color: #606266;
    background: #f4f4f5;
    border-left: 3px solid #c0c4cc;
    border-radius: 2px;
  }
  .quote-bar-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }
  .quote-bar-close {
    cursor: pointer;
    flex-shrink: 0;
  }

  .show-content {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 5px;

    .composer-text-wrap {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .composer-textarea {
      flex: 1 1 auto;
      min-height: 72px;
    }

    .composer-pending-strip {
      flex-shrink: 0;
      max-height: 42%;
      overflow-y: auto;
    }

    .show-content-textarea {
      flex: auto;
      resize: none;
      line-height: 20px;
      font-size: 16px;
      padding: 5px;
      border: #dcdfe6 solid 1px;
      margin: 2px;
      &:focus {
        outline: none !important;
      }
    }
    .show-content-video {
      max-height: 100%;
      margin: 2px auto 0px;
    }
    .show-content-img {
      object-fit: scale-down;
      margin: 0 auto;
      margin-top: 2px;
    }
    .show-content-voice {
      margin: auto;
    }
    .show-content-file {
      padding: 0 10px;
      width: 100%;
      max-width: 100%;
      line-height: 20px;
      text-align: center;
      align-self: center;
      word-break: break-all;
    }
  }

  .dropImgs-box {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    align-content: flex-start;
    outline: none;
    padding: 2px 4px;

    &:focus {
      box-shadow: inset 0 0 0 1px #409eff;
    }

    .pending-img-item {
      position: relative;
      display: inline-flex;
      margin: 2px 4px;
      padding: 2px;
      border-radius: 4px;
      border: 2px solid transparent;

      &.is-selected {
        border-color: #409eff;
      }

      img {
        min-width: 48px;
        min-height: 48px;
        max-width: 88px;
        max-height: 88px;
        object-fit: scale-down;
        display: block;
        background: #f2f3f5;
      }

      .pending-img-remove {
        position: absolute;
        top: 0;
        right: 0;
        width: 18px;
        height: 18px;
        line-height: 18px;
        text-align: center;
        font-size: 12px;
        color: #fff;
        background: rgba(0, 0, 0, 0.55);
        border-radius: 0 2px 0 4px;
        cursor: pointer;

        &:hover {
          background: #f56c6c;
        }
      }
    }
  }

  .file-list {
    padding: 2px 6px;
    .file-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #606266;
      .file-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pending-file-remove {
        cursor: pointer;
        color: #909399;
        &:hover {
          color: #f56c6c;
        }
      }
    }
  }

  .opration-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;

    .chats-bottom {
      font-size: 12px;
      color: #909399;
    }
    .composer-hint {
      color: #c0c4cc;
    }
  }
}
</style>
