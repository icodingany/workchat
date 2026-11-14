<template>
  <div class="tool-bar can-not-select">
    <div class="tool-start">
      <!-- 表情：默认 QQ/Emoji + 收藏表情包（对齐 kelailaichatpc） -->
      <div class="tool" title="表情" @click="showEmoji">
        <img class="icon" src="../../../../assets/svg/tool-bar-expression.svg" alt />
      </div>
      <!-- 发图片|视频|文件 -->
      <div class="tool" title="发送文件">
        <label class="label" for="sendFiles">
          <img class="icon" src="../../../../assets/svg/tool-bar-files.svg" alt />
        </label>
        <input
          v-show="false"
          type="file"
          id="sendFiles"
          multiple
          accept=".txt, .doc, .xls, .ppt, .docx, .xlsx, .pptx, .rar, .zip, .exe, .text, .apk, .mp3, .jpg, .png, .gif, .jpeg, .mp4"
          ref="toolsFile"
          @change="choseMedia('File')"
        />
      </div>
      <!-- 剪切 -->
      <div v-if="isDesktop" class="tool" title="截图" @click="shearScreen()">
        <img class="icon" src="../../../../assets/svg/tool-bar-shear.svg" alt />
      </div>
      <!-- 发语音 -->
      <div class="tool" title="发语音">
        <label class="label" for="sendVoiceId">
          <img class="icon" src="../../../../assets/svg/tool-bar-voice.svg" alt />
        </label>
        <input
          v-show="false"
          type="file"
          id="sendVoiceId"
          accept=".amr, .mp3"
          ref="toolsVoice"
          @change="choseMedia('Voice')"
        />
      </div>
      <!-- 发名片 -->
      <div class="tool" title="发名片" @click="showSendNameCard">
        <img class="icon" src="../../../../assets/svg/tool-bar-name-card.svg" alt />
      </div>
      <!-- 我的收藏 -->
      <div class="tool" title="我的收藏" @click="showResours">
        <img class="icon" src="../../../../assets/svg/tool-bar-shoucang.svg" alt />
      </div>
    </div>

    <div class="tool-end">
      <!-- 创建群聊 -->
      <div class="tool" @click="createChatRoom()" title="创建群">
        <img class="icon" src="../../../../assets/svg/tool-bar-create-room.svg" alt />
      </div>
    </div>

    <!-- 创建群聊弹框 -->
    <SlotFriends
      v-if="friendsDialogVisible"
      :dialogTilte="dialogTilte"
      :action="action"
      :dialogData="dialogData"
      :currentFriend="currentFriend"
      :friends="dialogData"
      :friendsDialogVisible="friendsDialogVisible"
      @closeSlotFriends="friendsDialogVisible = false"
    />

    <!-- 我的收藏弹框 -->
    <el-dialog append-to-body class="my-collection-dialog" title="我的收藏" v-model="resourcesDialog">
      <el-tabs style="width: 100%" v-model="resourcesType" @tab-click="setResourcesType">
        <el-tab-pane label="文本" name="Text">
          <el-table
            :data="myCollections"
            border
            style="width: 100%"
            height="354px"
            @selection-change="handleSelectionChange"
          >
            <el-table-column prop="content" label="内容"></el-table-column>
            <el-table-column type="selection" width="55" align="center"></el-table-column>
            <el-table-column fixed="right" label="操作" width="100">
              <template #default="{ row }">
                <el-button @click="deleteResource(row.id)" link size="small">删除</el-button>
                <el-button @click="sendResource(row)" link size="small">发送</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="图片" name="Picture" class="picture-list">
          <div
            class="picture-item"
            :class="{ 'picture-item-checked': currentItem.id === ri.id }"
            v-for="(ri, index2) in myCollections"
            :key="index2"
            @click="checkItem(ri)"
          >
            <img style="object-fit: 'conver'" :src="ri.content.url" alt="" />
            <i class="el-icon-delete delete-icon" @click="deleteResource(ri.id)"></i>
          </div>
        </el-tab-pane>

        <el-tab-pane label="链接" name="Link" class="link-list">
          <div
            v-for="(link, index3) in myCollections"
            :key="index3"
            class="we-app-item"
            :class="{ 'we-app-item-checked': currentItem.id === link.id }"
            :title="link.title"
            @click="checkItem(link)"
          >
            <img
              v-if="link.content.thumbUrl && link.content.thumbUrl.startsWith('http://www')"
              class="we-app-img"
              :src="link.content.thumbUrl"
              alt=""
            />
            <div v-else class="we-app-img-no">
              <i style="font-size: 20px" class="el-icon-picture-outline"></i>
            </div>
            <p class="we-app-name ellipsis" v-text="link.content.title"></p>
            <i class="el-icon-delete delete-icon" @click="deleteResource(link.id)"></i>
          </div>
        </el-tab-pane>

        <el-tab-pane label="小程序" name="WeApp" class="link-list">
          <div
            v-for="(weApp, index4) in myCollections"
            :key="index4"
            class="we-app-item"
            :class="{ 'we-app-item-checked': currentItem.id === weApp.id }"
            @click="checkItem(weApp)"
          >
            <img class="we-app-img" :src="weApp.content.iconUrl" alt="" />
            <p class="we-app-name ellipsis" v-text="weApp.content.appName"></p>
            <i class="el-icon-delete delete-icon" @click="deleteResource(weApp.id)"></i>
          </div>
        </el-tab-pane>

        <el-tab-pane label="视频" name="Video" class="picture-list">
          <div
            class="picture-item"
            :class="{ 'picture-item-checked': currentItem.id === vi.id }"
            v-for="(vi, indexV) in myCollections"
            :key="indexV"
            @click="checkItem(vi)"
          >
            <video
              v-if="(vi.content && vi.content.url) || (typeof vi.content === 'string' && vi.content)"
              style="width: 100%; height: 100%; object-fit: cover"
              :src="(vi.content && vi.content.url) || vi.content"
              muted
            />
            <i class="el-icon-delete delete-icon" @click.stop="deleteResource(vi.id)"></i>
          </div>
        </el-tab-pane>

        <el-tab-pane label="视频号" name="ShiPinHao" class="link-list">
          <div
            v-for="(sph, indexSph) in myCollections"
            :key="indexSph"
            class="we-app-item"
            :class="{ 'we-app-item-checked': currentItem.id === sph.id }"
            @click="checkItem(sph)"
          >
            <img
              class="we-app-img"
              :src="(sph.content && (sph.content.cover || sph.content.thumbUrl || sph.content.Thumb)) || ''"
              alt=""
            />
            <p class="we-app-name ellipsis" v-text="(sph.content && (sph.content.nickname || sph.content.des || sph.content.title)) || '视频号'"></p>
            <i class="el-icon-delete delete-icon" @click="deleteResource(sph.id)"></i>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <span>
          <el-button size="small" @click="resetResource">取 消</el-button>
          <el-button size="small" type="primary" @click="sendResources(resource2send, currentItem)">发 送</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 表情弹框：默认表情 / 收藏表情 -->
    <el-dialog
      append-to-body
      class="emoji-pick-dialog"
      title="选择表情"
      v-model="emojiDialog"
      width="440px"
      :modal="false"
    >
      <el-tabs v-model="emojiActiveTab" class="emoji-dialog-tabs">
        <el-tab-pane label="收藏表情" name="favorite">
          <div v-if="emojiList && emojiList.length" class="favorite-emoji-list">
            <div
              v-for="(emoji, index) in emojiList"
              :key="emoji.id || index"
              class="we-app-item favorite-emoji-item"
              @click.stop="sendEmoji(emoji)"
            >
              <img
                class="we-app-img-emoji"
                :src="getEmojiPreviewSrc(emoji)"
                alt=""
                referrerpolicy="no-referrer"
              />
              <i
                class="el-icon-delete"
                title="删除"
                @click.stop="deleteEmoji(emoji.id)"
              ></i>
            </div>
          </div>
          <div v-else class="favorite-empty">暂无收藏表情</div>
        </el-tab-pane>
        <el-tab-pane label="默认表情" name="default">
          <div class="scroll default-emoji-scroll">
            <img class="qq-face" src="/expression/qqface.png" usemap="#qqMapDlg" />
            <map name="qqMapDlg">
              <area
                v-for="(expression, index) in 105"
                :key="'qq-' + index"
                shape="rect"
                :coords="
                  (index % 15) * 25 +
                  ', ' +
                  parseInt(index / 15) * 25 +
                  ', ' +
                  ((index % 15) + 1) * 25 +
                  ', ' +
                  (parseInt(index / 15) + 1) * 25
                "
                :title="qqFaceMap[index]"
                @click="selectExpression(index)"
              />
            </map>
            <img src="/expression/emoji.png" usemap="#emojiMapDlg" />
            <map name="emojiMapDlg">
              <area
                v-for="(emoji, index) in 177"
                :key="'em-' + index"
                shape="rect"
                :coords="
                  (index % 15) * 25 +
                  ', ' +
                  parseInt(index / 15) * 25 +
                  ', ' +
                  ((index % 15) + 1) * 25 +
                  ', ' +
                  (parseInt(index / 15) + 1) * 25
                "
                :title="qqFaceMap[105 + index]"
                @click="selectExpression(105 + index)"
              />
            </map>
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <span>
          <el-button size="small" @click="resetEmoji">取 消</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import SlotFriends from '../SlotFriends'

import { ElMessage } from 'element-plus'
import { fileUpload, getFileUploadErrorMsg, isFileUploadOk } from '@/utils/upload'
import { isImageFileLike } from './answerWindowPaste'
import { resourcesList, deleteResources } from '@/api/httpApi'
import { buildResourceSend } from '@/utils/resourcePayload'
import { expressionMap, faceInsertText } from '@/utils/qqFaceMap'
import { TalkToFriendTask } from '@/api/webSocketApi'
import {
  getEmojiPreviewSrc,
  getEmojiSendUrl,
  normalizeEmojiPayloadForSend
} from '@/utils/emojiPayload'

export default {
  data() {
    return {
      qrCodeDialog: false, // 显示微信二维码窗口
      chatRoomQrCodeDialog: false, // 显示微信二维码窗口
      redEnvelopeDialog: false, // 显示红包
      transferMoneyDialog: false, // 显示红包
      managerVisiable: false, // 群管理
      circleDrawerVisiable: false, // 好友的朋友圈

      resourcesDialog: false, // 我的收藏弹框
      resourcesType: 'Text', // 资源类型 默认文本
      myCollections: [], // 资源列表
      resource2send: [], // 要发送的资源
      currentItem: {},

      emojiDialog: false,
      emojiActiveTab: 'favorite',
      emojiList: [],

      action: 0,
      dialogTilte: '添加群成员',
      dialogData: [],
      friendsDialogVisible: false
    }
  },
  components: {
    SlotFriends
  },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      currentMode: 'currentMode',
      isDesktop: 'isDesktop',
      content: 'conversation/content',
      contentType: 'conversation/contentType',
      currentFriend: 'conversation/currentFriend',
      currentFriendId: 'conversation/currentFriendId',
      currentWeChatId: 'conversation/currentWeChatId',
      currentContacts: 'conversation/currentContacts', // 当前的通讯录列表 不分页
      currentCustomers: 'conversation/currentCustomers' // 当前的群聊列表 不分页
    }),
    // qq表情
    qqFaceMap() {
      return expressionMap || {}
    },
    friends() {
      return this.currentContacts.concat(this.currentCustomers)
    }
  },
  methods: {
    // 展示我的收藏
    showResours() {
      this.resourcesDialog = true
      this.queryResources()
    },
    // 设置资源类型
    setResourcesType(rt) {
      this.resourcesType = rt.name
      this.queryResources()
    },
    // 查询我收藏的数据
    queryResources() {
      resourcesList(1, 100, this.resourcesType).then((res) => {
        console.log(res)
        if (res.code === 0 && res.data.rows) {
          if (this.resourcesType === 'Text') {
            this.myCollections = res.data.rows
          } else {
            this.myCollections = res.data.rows.map((x) => {
              let obj = { ...x }
              try {
                obj.content = JSON.parse(x.content)
              } catch (error) {
                console.log(error)
              }
              return obj
            })
          }
        } else {
          this.myCollections = []
        }
      })
    },
    handleSelectionChange(val) {
      this.resource2send = val
    },
    // 删除收藏的信息
    deleteResource(resourceId) {
      if (resourceId) {
        deleteResources(resourceId).then((res) => {
          if (res.code === 0) {
            this.queryResources()
          }
        })
      }
    },
    checkItem(item) {
      this.currentItem = item
      //   this.resource2send.push(item)
    },
    // 重置选中的信息
    resetResource() {
      this.resource2send = []
      this.currentItem = {}
      this.resourcesDialog = false
    },
    // 发送消息
    sendResource(resource) {
      const mapped = buildResourceSend(resource.type, resource.content)
      if (!mapped) {
        this.$message.warning(
          resource.type === 'ShiPinHao' || resource.type === 25 || resource.type === '25'
            ? '视频号内容不完整，无法发送'
            : '不支持的收藏类型！'
        )
        return
      }
      if (this.currentWeChatId && this.currentFriendId) {
        const sent = TalkToFriendTask(
          this.currentWeChatId,
          this.currentFriendId,
          mapped.type,
          mapped.content
        )
        if (sent === false) {
          this.$message.warning('发送失败，请检查连接或内容完整性')
          return
        }
        this.$message.success('任务已经下发！')
      } else {
        this.$message.warning('请先选中一个好友！')
      }
      this.resourcesDialog = false
    },
    getEmojiPreviewSrc,
    showEmoji() {
      this.emojiDialog = true
      this.emojiActiveTab = 'favorite'
      resourcesList(1, 100, 'Emoji').then((res) => {
        if (res.code === 0 && res.data && res.data.rows) {
          const jc = []
          res.data.rows.forEach((x) => {
            try {
              const nc = typeof x.content === 'string' ? JSON.parse(x.content) : { ...x.content }
              nc.id = x.id
              jc.push(nc)
            } catch (e) {
              /* ignore */
            }
          })
          this.emojiList = jc
        } else {
          this.emojiList = []
        }
      })
    },
    resetEmoji() {
      this.emojiDialog = false
    },
    deleteEmoji(emojiId) {
      if (!emojiId) return
      deleteResources(emojiId).then((res) => {
        if (res.code === 0) {
          this.emojiList = this.emojiList.filter((x) => x.id !== emojiId)
        }
      })
    },
    sendEmoji(emoji) {
      if (!this.currentWeChatId || !this.currentFriendId) {
        this.$message.warning('请先选中一个好友！')
        return
      }
      const cdnUrl = getEmojiSendUrl(emoji)
      const payload = normalizeEmojiPayloadForSend(emoji, cdnUrl)
      if (!payload) {
        this.$message.warning('表情资源不完整，无法发送')
        return
      }
      TalkToFriendTask(this.currentWeChatId, this.currentFriendId, 'Emoji', JSON.stringify(payload))
      this.$message.success('任务已经下发！')
      this.resetEmoji()
    },
    // 发送多条消息
    sendResources(resource2send, currentItem) {
      if (this.currentWeChatId && this.currentFriendId) {
        console.log(resource2send)
        if (this.resourcesType === 'Text') {
          for (const ri of resource2send) {
            this.sendResource(ri)
          }
        } else {
          console.log(currentItem)
          this.sendResource(currentItem)
        }
        this.resetResource()
      } else {
        this.$alert('请先选中一个好友！', '提示', { type: 'warning' })
      }
    },
    // 选择表情
    selectExpression(val) {
      if (this.contentType !== 'Text') {
        this.$store.commit('conversation/SET_CONTENT', '')
      }
      const rm = faceInsertText(val)
      if (rm) {
        const newContent = this.content + rm
        this.$store.commit('conversation/SET_CONTENT_TYPE', 'Text')
        this.$store.commit('conversation/SET_CONTENT', newContent)
        this.emojiDialog = false
      }
      //   else {
      //     this.$message.warning('无效选择')
      //   }
    },
    getComposerAnswerWindow() {
      let p = this.$parent
      for (let i = 0; i < 4 && p; i++) {
        if (p.$refs && p.$refs.answerWindow) return p.$refs.answerWindow
        p = p.$parent
      }
      return null
    },
    ensureUploadFileMime(file) {
      if (!file || (file.type && String(file.type).trim())) return file
      const ext = file.name && file.name.includes('.')
        ? file.name.replace(/.+\./, '').toLowerCase()
        : ''
      const mimeByExt = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        jfif: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        heic: 'image/heic',
        heif: 'image/heif',
        mp4: 'video/mp4'
      }
      const mime = mimeByExt[ext]
      if (!mime) return file
      try {
        return new File([file], file.name || `file.${ext}`, { type: mime, lastModified: file.lastModified })
      } catch (_) {
        return file
      }
    },
    prepareUploadFile(file) {
      const normalized = this.ensureUploadFileMime(file)
      const mime = String(normalized.type || '').toLowerCase()
      const ext = normalized.name && normalized.name.includes('.')
        ? normalized.name.replace(/.+\./, '').toLowerCase()
        : ''
      const isHeic =
        ['heic', 'heif'].indexOf(ext) >= 0 || mime.indexOf('heic') >= 0 || mime.indexOf('heif') >= 0
      if (!isHeic) return Promise.resolve(normalized)
      return new Promise((resolve) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(normalized)
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(normalized)
            return
          }
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(normalized)
              return
            }
            const baseName = (normalized.name || 'image.heic').replace(/\.(heic|heif)$/i, '')
            resolve(new File([blob], `${baseName || 'image'}.jpg`, { type: 'image/jpeg' }))
          }, 'image/jpeg', 0.92)
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(normalized)
        }
        img.src = objectUrl
      })
    },
    resolveMediaComputedType(file, voiceMode) {
      const mime = String(file.type || '').toLowerCase()
      const ext = file.name && file.name.includes('.')
        ? file.name.replace(/.+\./, '').toLowerCase()
        : ''
      if (voiceMode) return 'Voice'
      if (['jpg', 'png', 'gif', 'jpeg', 'heic', 'heif', 'webp', 'bmp', 'jfif'].indexOf(ext) >= 0) {
        return 'Picture'
      }
      if (mime.indexOf('image/') === 0 || isImageFileLike(file)) return 'Picture'
      if (ext === 'mp4' || mime.indexOf('video/') === 0) return 'Video'
      return 'File'
    },
    async choseMediaVoice() {
      const fileObj = this.$refs.toolsVoice && this.$refs.toolsVoice.files
      if (!fileObj || !fileObj[0]) return

      const rawFile = fileObj[0]
      const fileSize = rawFile.size
      const fileName = rawFile.name || 'file'
      const fileType = fileName.includes('.') ? fileName.replace(/.+\./, '').toLowerCase() : ''

      if (fileSize > 104857600 || fileSize <= 0) {
        this.$message.warning('文件不能大于100M，文件不能是空文件')
        if (this.$refs.toolsVoice) this.$refs.toolsVoice.value = ''
        return
      }
      if (['amr', 'mp3'].indexOf(fileType) < 0) {
        this.$message.warning('发送语音只能选择MP3或AMR文件')
        if (this.$refs.toolsVoice) this.$refs.toolsVoice.value = ''
        return
      }

      const toast = ElMessage({
        message: '语音上传中…',
        type: 'info',
        duration: 0,
        iconClass: 'el-icon-loading'
      })

      try {
        let duration = 0
        try {
          const objectUrl = URL.createObjectURL(rawFile)
          duration = await new Promise((resolve, reject) => {
            const audio = new Audio()
            audio.preload = 'metadata'
            audio.onloadedmetadata = () => resolve(audio.duration)
            audio.onerror = () => reject(new Error('metadata failed'))
            audio.src = objectUrl
          })
          URL.revokeObjectURL(objectUrl)
        } catch (_) {
          duration = 0
        }

        const formdata = new FormData()
        formdata.append('myfile', rawFile)
        if (fileType === 'mp3') formdata.append('isMp3ToAmr', true)
        else if (fileType === 'amr') formdata.append('isAmrToMp3', false)

        const res = await fileUpload(formdata)
        if (!isFileUploadOk(res)) {
          ElMessage.error(getFileUploadErrorMsg(res))
          return
        }
        let content = res.data.url
        duration = Math.ceil(duration) || 1
        content = content + `?duration=${duration}`
        this.$store.commit('conversation/SET_CONTENT', content)
        this.$store.commit('conversation/SET_CONTENT_TYPE', 'Voice')
        if (this.$refs.toolsVoice) this.$refs.toolsVoice.value = ''
        ElMessage.success('语音已载入输入框，请点击发送')
      } catch (err) {
        ElMessage.error('文件上传失败：' + (err && err.message ? err.message : err))
      } finally {
        toast.close()
      }
    },
    // 对齐 kelailaichatpc：图片进待发区（JPEG 重编码+并发上传），非图进 pendingFiles
    async choseMedia(type) {
      if (type === 'Voice') return this.choseMediaVoice()

      const input = this.$refs.toolsFile
      const fileList = input && input.files ? Array.from(input.files) : []
      if (!fileList.length) return

      const answerWindow = this.getComposerAnswerWindow()
      if (!answerWindow || typeof answerWindow.uploadPastedImages !== 'function') {
        ElMessage.error('输入区未就绪，请稍后重试')
        if (input) input.value = ''
        return
      }

      const images = []
      const others = []
      const prepared = await Promise.all(
        fileList.map(async (rawFile) => {
          const size = rawFile.size
          if (size <= 0) {
            ElMessage.error(`文件不能是空文件: ${rawFile.name || ''}`)
            return null
          }
          if (size > 104857600) {
            ElMessage.error(`文件不能大于100M: ${rawFile.name || ''}`)
            return null
          }
          const uploadFile = await this.prepareUploadFile(rawFile)
          const kind = this.resolveMediaComputedType(uploadFile, false)
          return { uploadFile, kind }
        })
      )
      for (const item of prepared) {
        if (!item) continue
        if (item.kind === 'Picture') images.push(item.uploadFile)
        else others.push(item.uploadFile)
      }

      if (!images.length && !others.length) {
        if (input) input.value = ''
        return
      }

      const toast = ElMessage({
        message: '文件上传中…',
        type: 'info',
        duration: 0,
        iconClass: 'el-icon-loading'
      })
      try {
        if (images.length) await answerWindow.uploadPastedImages(images)
        if (others.length) await answerWindow.uploadPastedFiles(others)
      } catch (e) {
        ElMessage.error('文件上传失败!')
      } finally {
        toast.close()
        if (input) input.value = ''
      }
    },

    // 创建群聊
    createChatRoom() {
      if (!this.currentWeChatId) {
        this.$message.warning('请先选择一个微信！')
        return
      }
      this.dialogTilte = '创建群聊'
      this.action = 8
      this.dialogData = this.friends
      this.friendsDialogVisible = true
    },
    // 显示发名片窗口
    showSendNameCard() {
      this.dialogTilte = '发送名片'
      this.action = 'NameCard'
      this.dialogData = this.friends
      this.friendsDialogVisible = true
    },
    // 截图
    shearScreen() {
      if (!this.isDesktop) {
        this.$message.warning('web版不支持截图！')
        return
      }
      // 和主进程通讯
      this.$ipcRenderer.send('operations', 'screencap')
      // 监听主进程
      // this.$ipcRenderer.on('screencap', (event, arg) => {
      //   if (arg) {
      //     // document.execCommand("paste")
      //   }
      // })
    },
    // 显示发红包的dialog
    showRedEnvelopeDialog() {
      this.redEnvelopeDialog = true
      this.dialogTilte = '发红包'
    }
  }
}
</script>

<style lang="scss" scoped>
.tool-bar {
  height: 40px;
  min-height: 40px;
  width: 100%;
  position: relative;
  display: flex;
  justify-content: space-between;
  border-top: solid $border-color-base 2px;

  .tool-start {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    .tool {
      justify-self: start;
      margin-left: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;

      .icon,
      .label {
        height: 24px;
        width: 24px;
        min-width: 24px;
        cursor: pointer;
      }
    }

    .remittance-window {
      left: 112px;
    }
  }

  .tool-end {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    .tool {
      justify-self: start;
      margin-right: 4px;
      width: 24px;
      min-width: 24px;
      height: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  :deep(.reply-drawer) {
    .rtl {
      max-width: 310px;
    }
    .el-drawer__body {
      width: 310px;
      padding: 0 5px;
    }
  }
}
</style>

<style lang="scss">
/* append-to-body：样式需非 scoped；覆盖全局 .we-app-item(90px) */
.emoji-pick-dialog {
  .default-emoji-scroll {
    height: 280px;
    overflow-y: auto;
  }
  .favorite-emoji-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 360px;
    overflow: auto;
    padding: 6px 2px;
  }
  .favorite-emoji-list .we-app-item,
  .favorite-emoji-list .favorite-emoji-item {
    position: relative;
    width: 56px !important;
    height: 56px !important;
    min-width: 56px;
    max-width: 56px;
    margin: 0 !important;
    padding: 2px;
    flex-direction: row;
    overflow: visible;
    &:hover {
      background: #f3f4f6;
      border-radius: 4px;
    }
  }
  .favorite-emoji-list .we-app-img-emoji {
    width: 48px !important;
    height: 48px !important;
    max-width: 48px;
    max-height: 48px;
    object-fit: contain;
    border-radius: 0;
    display: block;
  }
  .favorite-emoji-list .el-icon-delete {
    position: absolute !important;
    top: 0 !important;
    right: 0 !important;
    z-index: 2;
    font-size: 14px;
    color: #f56c6c !important;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 2px;
    line-height: 1;
    padding: 1px;
  }
  .favorite-empty {
    color: #999;
    padding: 40px 0;
    text-align: center;
  }
}
</style>
