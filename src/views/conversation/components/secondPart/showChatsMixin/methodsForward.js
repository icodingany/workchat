import store from '@/store'
import { ForwardMsgTask, ForwardMultiTask, TalkToFriendTask } from '@/api/webSocketApi'
import { addResources, textTranslate } from '@/api/httpApi'
import { decodeMsgContent } from '@/utils/downloadFileDetail'
import {
  canForwardChat,
  canQuoteChat,
  resolveMsgRemoteId,
  shouldShowMergeForward,
  getForwardTargetId,
  resolveForwardConvLocalId,
  createEmptyForwardSelectionByTab,
  toggleForwardSelectionByTab,
  resolveActiveForwardSelection
} from '@/utils/forwardHelpers'
import { looksLikeEmojiPayload, getEmojiSendUrl } from '@/utils/emojiPayload'
import { normalizePictureUrl, safeHttpUrl } from '@/utils/picturePreview'
import { prepareShiPinHaoMaterialContent } from '@/utils/shiPinHaoPayload'
import { isContentType } from '@/utils/chatMessageFields'

export default {
  methods: {
    collectionMsg(chat) {
const { ContentType, Content, MsgRemoteId, jContent } = chat
      if (ContentType === 'Picture' || ContentType === 2) {
        if (!jContent || !jContent.url) {
          this.$message.warning('请先获取大图，再收藏！')
          return
        }
      }
      if (ContentType === 'Video' || ContentType === 4) {
        if (!jContent || !safeHttpUrl(jContent.url)) {
          this.$message.warning('请先获取视频，再收藏！')
          return
        }
      }
      let saveType = ContentType
      let saveContent = Content
      if (isContentType(ContentType, 'ShiPinHao', 25)) {
        const prepared = prepareShiPinHaoMaterialContent(jContent || Content)
        if (!prepared) {
          this.$message.warning('视频号内容未就绪或缺少封面，请等消息补全后再收藏')
          return
        }
        saveType = 'ShiPinHao'
        saveContent = JSON.stringify(prepared)
      } else if (
        ContentType === 'Emoji' ||
        ContentType === 14 ||
        ContentType === '14' ||
        looksLikeEmojiPayload(jContent)
      ) {
        if (!getEmojiSendUrl(jContent)) {
          this.$message.warning('表情资源不完整，无法收藏')
          return
        }
        saveType = 'Emoji'
        saveContent = typeof Content === 'string' ? Content : JSON.stringify(jContent || {})
      }
      addResources(saveContent, saveType, MsgRemoteId)
        .then((res) => {
          if (res.code === 0) {
            this.$message.success('添加到素材库成功！')
          }
        })
        .catch((err) => {
          this.$message.error(err.message)
        })
    },
    showMsgContextMenu(event, chat) {
const items = this.buildMsgContextMenuItems(chat)
      if (!items.length) return
      this.msgContextChat = chat
      this.msgContextMenuItems = items
      this.msgContextMenuVisible = true
      this.msgContextMenuX = event.clientX
      this.msgContextMenuY = event.clientY
      this.$nextTick(() => {
        document.addEventListener('click', this.hideMsgContextMenu)
      })
    },
    hideMsgContextMenu() {
this.msgContextMenuVisible = false
      this.msgContextChat = null
      this.msgContextMenuItems = []
      document.removeEventListener('click', this.hideMsgContextMenu)
    },
    buildMsgContextMenuItems(chat) {
const items = []
      const t = chat.ContentType
      if (t === 'Text' || t === 1) {
        items.push({ key: 'copy', label: '复制' })
      }
      if (t === 'Picture' || t === 2) {
        items.push({ key: 'downloadPicture', label: '下载图片' })
        items.push({ key: 'copyPicture', label: '复制图片' })
      }
      if ((t === 'Voice' || t === 3) && this.resolveMediaUrl(chat)) {
        items.push({ key: 'downloadVoice', label: '下载语音' })
      }
      if (chat.MsgId && this.collectionType.indexOf(t) >= 0) {
        items.push({ key: 'collect', label: '收藏到素材库' })
      }
      if (
        this.isSelfMsg(chat) &&
        Object.prototype.hasOwnProperty.call(chat, 'MsgRemoteId') &&
        this.revokeMap.indexOf(t) >= 0 &&
        !chat.IsRevoke
      ) {
        items.push({ key: 'revoke', label: '撤回' })
      }
      items.push({ key: 'multiSelect', label: '多选' })
      if (canForwardChat(chat)) {
        items.push({ key: 'forward', label: '转发' })
      }
      if (canQuoteChat(chat)) {
        items.push({ key: 'quote', label: '引用' })
      }
      if (t === 'Text' || t === 1) {
        items.push({ key: 'translate', label: '翻译' })
      }
      return items
    },
    onMsgContextMenuSelect(item) {
const chat = this.msgContextChat
      this.hideMsgContextMenu()
      if (!chat || !item) return
      if (item.key === 'copy') this.copyTextMessage(chat)
      else if (item.key === 'downloadPicture') this.downloadPictureMessage(chat)
      else if (item.key === 'copyPicture') this.copyPictureMessage(chat)
      else if (item.key === 'downloadVoice') this.downloadVoiceMessage(chat)
      else if (item.key === 'collect') this.collectionMsg(chat)
      else if (item.key === 'revoke') this.revokeMessageTask(chat)
      else if (item.key === 'multiSelect') {
        this.$store.commit('conversation/SET_SELECT_MODE', true)
        this.$store.commit('conversation/TOGGLE_SELECTED_MSG', chat)
      } else if (item.key === 'forward') this.openForwardDialog([chat], false)
      else if (item.key === 'quote') this.$store.commit('conversation/SET_QUOTE_MSG', chat)
      else if (item.key === 'translate') this.translateChat(chat)
    },
    translateKey(chat) {
return String(resolveMsgRemoteId(chat) || chat.MsgId || '')
    },
    chatResourceFetchError(chat) {
const err = chat && chat._resourceFetchError
      return err ? String(err).trim() : ''
    },
    isMsgSelected(chat) {
const id = chat.MsgRemoteId || chat.MsgId
      return (this.selectedMsgs || []).some((c) => (c.MsgRemoteId || c.MsgId) === id)
    },
    toggleSelectMsg(chat) {
this.$store.commit('conversation/TOGGLE_SELECTED_MSG', chat)
    },
    exitSelectMode() {
this.$store.commit('conversation/SET_SELECT_MODE', false)
    },
    async onSelectBarForward() {
const list = (this.selectedMsgs || []).filter(canForwardChat)
      if (!list.length) {
        this.$message.warning('所选消息尚未同步，无法转发')
        return
      }
      let merge = false
      if (list.length >= 2) {
        const canMerge = shouldShowMergeForward(this.supportsMergeForward, list.length)
        try {
          await this.$confirm(
            canMerge
              ? '请选择转发方式'
              : '当前仅支持逐条转发（合并转发需更新手机端）',
            '转发',
            {
              distinguishCancelAndClose: true,
              confirmButtonText: canMerge ? '合并转发' : '逐条转发',
              cancelButtonText: canMerge ? '逐条转发' : '取消',
              type: 'info'
            }
          )
          merge = canMerge
        } catch (action) {
          if (action === 'cancel' && canMerge) {
            merge = false
          } else {
            return
          }
        }
      }
      if (merge && list.length > 50) {
        this.$message.warning('合并转发一次最多 50 条，请拆分后再试')
        return
      }
      this.openForwardDialog(list, merge)
    },
    openForwardDialog(chats, merge) {
const list = (chats || []).filter(canForwardChat)
      if (!list.length) {
        this.$message.warning('消息尚未同步，无法转发')
        return
      }
      if (merge && !this.supportsMergeForward) {
        this.$message.warning('需更新手机端后才能合并转发')
        return
      }
      this.forwardChats = list
      this.forwardMerge = !!merge
      this.forwardActiveTab = 'chat'
      this.forwardSearchText = ''
      this.clearForwardTargetSelection()
      this.forwardDialogVisible = true
    },
    clearForwardTargetSelection() {
      this.forwardSelectionByTab = createEmptyForwardSelectionByTab()
    },
    toggleForwardTarget(tab, row) {
      this.forwardSelectionByTab = toggleForwardSelectionByTab(
        this.forwardSelectionByTab,
        tab,
        row
      )
    },
    closeForwardDialog() {
      this.forwardDialogVisible = false
      this.forwardChats = []
      this.forwardMerge = false
      this.forwardSearchText = ''
      this.clearForwardTargetSelection()
    },
    confirmForwardTargets() {
      const selected = resolveActiveForwardSelection(this.forwardSelectionByTab, this.forwardActiveTab)
      const remoteIds = selected.map(getForwardTargetId).filter(Boolean)
      if (!remoteIds.length) {
        this.$message.warning('请选择转发对象')
        return
      }
      this.onForwardTargets(remoteIds)
    },
    onForwardTargets(remoteIds) {
      const wxId = this.currentWeChatId
      const ids = (remoteIds || []).filter(Boolean)
      if (!wxId || !ids.length) {
        this.$message.warning('请选择转发对象')
        return
      }
      if (store.state.webSocketState !== 1 || !store.state.webSocketToken) {
        this.$message.warning('WebSocket 未连接，转发失败')
        return
      }
      const msgIds = this.forwardChats.map((c) => resolveMsgRemoteId(c)).filter(Boolean)
      if (!msgIds.length) {
        this.$message.warning('消息尚未同步，无法转发')
        return
      }
      let ok = 0
      for (let i = 0; i < ids.length; i++) {
        const convId = ids[i]
        const localId = resolveForwardConvLocalId(this.currentConvs, convId)
        let sent
        if (msgIds.length === 1 && !this.forwardMerge) {
          sent = ForwardMsgTask(wxId, msgIds[0], convId, localId)
        } else {
          sent = ForwardMultiTask({
            WxId: wxId,
            MsgIds: msgIds,
            ConvIds: [convId],
            LocalIds: localId ? [localId] : [],
            Merge: this.forwardMerge
          })
        }
        if (sent !== false) ok++
      }
      if (ok) {
        this.$message.success('已发送转发指令')
        this.exitSelectMode()
      } else {
        this.$message.warning('WebSocket 未连接，转发失败')
      }
      this.closeForwardDialog()
    },
    async translateChat(chat) {
const key = this.translateKey(chat)
      if (!key) return
      const existing = this.translations[key]
      if (existing && existing.text && !existing.loading) {
        this.$store.commit('conversation/SET_TRANSLATION', { key, text: '', loading: false })
        return
      }
      this.$store.commit('conversation/SET_TRANSLATION', { key, loading: true })
      try {
        const res = await textTranslate(chat.Content || '')
        const body = (res && res.data) || {}
        if (body.code !== undefined && body.code !== 0) {
          throw new Error(body.msg || '翻译失败')
        }
        const data = body.data || body
        const text = data.TargetText || data.targetText || ''
        if (!text) throw new Error(body.msg || '空结果')
        this.$store.commit('conversation/SET_TRANSLATION', { key, text, loading: false })
      } catch (e) {
        this.$store.commit('conversation/SET_TRANSLATION', {
          key,
          loading: false,
          error: (e && e.message) || '翻译失败'
        })
      }
    },
    resolveMediaUrl(chat) {
if (!chat) return ''
      const j = chat.jContent
      if (j && safeHttpUrl(j.url)) return j.url
      if (safeHttpUrl(chat.Content)) return chat.Content
      return ''
    },
    copyTextMessage(chat) {
const text = chat.Content || ''
      if (!text) {
        this.$message.warning('没有可复制的内容')
        return
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => this.$message.success('已复制'),
          () => this.$message.error('复制失败')
        )
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          this.$message.success('已复制')
        } catch (e) {
          this.$message.error('复制失败')
        }
        document.body.removeChild(ta)
      }
    },
    async downloadByUrl(url, filename) {
if (!safeHttpUrl(url)) {
        this.$message.warning('暂无文件地址')
        return
      }
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = filename || 'download'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(objectUrl)
        this.$message.success('已开始下载')
      } catch (e) {
        window.open(url, '_blank')
      }
    },
    downloadPictureMessage(chat) {
const url = this.resolveMediaUrl(chat)
      if (!url) {
        this.$message.warning('请先获取大图')
        return
      }
      this.downloadByUrl(url, 'image.jpg')
    },
    downloadVoiceMessage(chat) {
const url = this.resolveMediaUrl(chat)
      if (!url) {
        this.$message.warning('暂无语音地址')
        return
      }
      this.downloadByUrl(url, 'voice.mp3')
    },
    async copyPictureMessage(chat) {
const url = this.resolveMediaUrl(chat)
      if (!url) {
        this.$message.warning('请先获取大图')
        return
      }
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type || 'image/png']: blob })
          ])
          this.$message.success('图片已复制到剪贴板')
        } else {
          this.$message.warning('当前环境不支持复制图片，请使用下载')
        }
      } catch (e) {
        this.$message.error('复制图片失败，请稍后重试')
      }
    }
  }
}
