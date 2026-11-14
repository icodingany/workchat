<template>
  <div class="msg-composer">
    <div class="msg-list" v-if="value.length">
      <div class="msg-row" v-for="(msg, index) in value" :key="index">
        <span class="msg-type">[{{ typeLabel(msg.ContentType) }}]</span>
        <span class="msg-desc ellipsis" :title="msgSummary(msg)">{{ msgSummary(msg) }}</span>
        <el-button link size="small" @click="removeAt(index)">删除</el-button>
        <el-button link size="small" :disabled="index === 0" @click="moveUp(index)">上移</el-button>
        <el-button link size="small" :disabled="index === value.length - 1" @click="moveDown(index)">下移</el-button>
      </div>
    </div>
    <div v-else class="empty-hint">暂无消息，请在下方添加</div>

    <div class="add-box">
      <el-tabs v-model="msgType" tab-position="top" style="width: 100%" @tab-click="onTabChange">
        <el-tab-pane label="文本" name="Text">
          <el-input
            v-model="textContent"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="请输入文本"
            resize="none"
          />
        </el-tab-pane>
        <el-tab-pane label="图片" name="Picture">
          <div class="upload-row">
            <label v-if="!pictureUrl" class="upload-btn" for="mc-picture">
              <i class="el-icon-plus"></i> 上传图片
            </label>
            <input
              v-show="false"
              id="mc-picture"
              ref="pictureInput"
              type="file"
              accept=".jpg,.png,.jpeg,.gif"
              @change="chosePicture"
            />
            <template v-if="pictureUrl">
              <img class="preview-img" :src="pictureUrl" alt="" />
              <span class="ellipsis file-name">{{ pictureName }}</span>
              <el-button link @click="clearMedia('Picture')">删除</el-button>
            </template>
          </div>
        </el-tab-pane>
        <el-tab-pane label="语音" name="Voice">
          <div class="upload-row">
            <label v-if="!voiceUrl" class="upload-btn" for="mc-voice">
              <i class="el-icon-plus"></i> 上传语音
            </label>
            <input
              v-show="false"
              id="mc-voice"
              ref="voiceInput"
              type="file"
              accept=".mp3,.amr"
              @change="choseVoice"
            />
            <template v-if="voiceUrl">
              <audio :src="voicePlayUrl || voiceUrl" controls style="max-width: 280px" />
              <span class="ellipsis file-name">{{ voiceName }}</span>
              <el-button link @click="clearMedia('Voice')">删除</el-button>
            </template>
          </div>
        </el-tab-pane>
        <el-tab-pane label="视频" name="Video">
          <div class="upload-row">
            <label v-if="!videoUrl" class="upload-btn" for="mc-video">
              <i class="el-icon-plus"></i> 上传视频
            </label>
            <input
              v-show="false"
              id="mc-video"
              ref="videoInput"
              type="file"
              accept=".mp4"
              @change="choseVideo"
            />
            <template v-if="videoUrl">
              <video :src="videoUrl" controls style="max-height: 120px; max-width: 200px" />
              <span class="ellipsis file-name">{{ videoName }}</span>
              <el-button link @click="clearMedia('Video')">删除</el-button>
            </template>
          </div>
        </el-tab-pane>
        <el-tab-pane label="文件" name="File">
          <div class="upload-row">
            <label v-if="!fileContent" class="upload-btn" for="mc-file">
              <i class="el-icon-plus"></i> 上传文件
            </label>
            <input v-show="false" id="mc-file" ref="fileInput" type="file" @change="choseFile" />
            <template v-if="fileContent">
              <span class="ellipsis file-name">{{ fileName }}</span>
              <el-button link @click="clearMedia('File')">删除</el-button>
            </template>
          </div>
        </el-tab-pane>
        <el-tab-pane label="链接" name="Link">
          <div class="res-list">
            <div
              v-for="(link, index) in linkList"
              :key="'l' + index"
              class="res-item"
              :class="{ checked: linkContent && linkContent.id === link.id }"
              @click="linkContent = link"
            >
              <p class="ellipsis">{{ (link.content && link.content.title) || '链接' }}</p>
            </div>
            <div v-if="!linkList.length" class="empty-hint">暂无链接素材，请先在素材库添加</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="小程序" name="WeApp">
          <div class="res-list">
            <div
              v-for="(app, index) in weAppList"
              :key="'w' + index"
              class="res-item"
              :class="{ checked: appContent && appContent.id === app.id }"
              @click="appContent = app"
            >
              <img v-if="app.content && app.content.iconUrl" class="res-icon" :src="app.content.iconUrl" alt="" />
              <p class="ellipsis">{{ (app.content && app.content.appName) || '小程序' }}</p>
            </div>
            <div v-if="!weAppList.length" class="empty-hint">暂无小程序素材，请先在素材库添加</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="名片" name="NameCard">
          <div class="picker-toolbar">
            <el-input
              v-model="cardKeyword"
              size="small"
              clearable
              placeholder="昵称搜索"
              style="width: 160px"
              @keyup.enter="loadContacts"
            />
            <el-button size="small" :disabled="!wechatId" @click="loadContacts">刷新</el-button>
          </div>
          <div v-if="!wechatId" class="empty-hint">请先选择企微号</div>
          <div v-else class="res-list namecard-list">
            <div
              v-for="(c, index) in contactRows"
              :key="'c' + index"
              class="res-item"
              :class="{ checked: nameCard && nameCard.remoteId === c.remoteId }"
              @click="nameCard = c"
            >
              <img v-if="c.avatar" class="res-icon" :src="c.avatar" alt="" />
              <p class="ellipsis">{{ c.name || c.remoteId }}</p>
            </div>
            <div v-if="!contactRows.length" class="empty-hint">暂无联系人</div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <div class="add-actions">
        <el-button size="small" @click="materialPickerVisible = true">从素材库选择</el-button>
        <el-button size="small" @click="resetDraft">重置</el-button>
        <el-button size="small" type="primary" @click="addMsg">添加</el-button>
      </div>
    </div>

    <MaterialPickerDialog v-model="materialPickerVisible" @select="onMaterialPicked" />
  </div>
</template>

<script>
import { fileUpload } from '@/utils/upload'
import { resourcesList } from '@/api/httpApi'
import { pageWwContacts } from '@/api/httpApiAdmin'
import MaterialPickerDialog from '@/components/MaterialPickerDialog.vue'
import { materialToComposerMsg, filterMaterialsByType } from '@/utils/resourcePayload'

const TYPE_LABEL = {
  Text: '文本',
  Picture: '图片',
  Voice: '语音',
  Video: '视频',
  Link: '链接',
  WeApp: '小程序',
  File: '文件',
  NameCard: '名片'
}

export default {
  name: 'MsgComposer',
  components: {
    MaterialPickerDialog
  },
  props: {
    /** Vue3 v-model */
    modelValue: {
      type: Array,
      default: () => []
    },
    /** 选名片时需要 */
    wechatId: {
      type: String,
      default: ''
    },
    max: {
      type: Number,
      default: 20
    }
  },
  computed: {
    /** 当前消息列表（v-model） */
    value() {
      return this.modelValue || []
    }
  },
  data() {
    return {
      msgType: 'Text',
      textContent: '',
      pictureUrl: '',
      pictureName: '',
      voiceUrl: '',
      voicePlayUrl: '',
      voiceName: '',
      videoUrl: '',
      videoName: '',
      fileContent: '',
      fileName: '',
      linkContent: null,
      appContent: null,
      nameCard: null,
      linkList: [],
      weAppList: [],
      contactRows: [],
      cardKeyword: '',
      materialPickerVisible: false
    }
  },
  watch: {
    wechatId() {
      this.nameCard = null
      this.contactRows = []
    }
  },
  methods: {
    typeLabel(t) {
      return TYPE_LABEL[t] || t || '-'
    },
    msgSummary(msg) {
      if (!msg) return ''
      if (msg.desc) return msg.desc
      if (msg.ContentType === 'Text') return msg.Content || ''
      if (msg.ContentType === 'Picture' || msg.ContentType === 'Video' || msg.ContentType === 'Voice') {
        return msg.Content || ''
      }
      if (msg.jContent) {
        return msg.jContent.title || msg.jContent.appName || msg.jContent.name || msg.Content || ''
      }
      try {
        const j = JSON.parse(msg.Content)
        return (j && (j.name || j.title || j.appName)) || msg.Content
      } catch (e) {
        return msg.Content || ''
      }
    },
    emitList(list) {
      this.$emit('update:modelValue', list)
      this.$emit('input', list)
    },
    /** 从素材库选择：收藏素材直接加入消息列表 */
    onMaterialPicked(row) {
      const msg = materialToComposerMsg(row)
      if (!msg) {
        this.$message.warning('该素材类型不支持群发')
        return
      }
      if (this.value.length >= this.max) {
        this.$message.warning('最多添加' + this.max + '条消息')
        return
      }
      this.emitList(this.value.concat([msg]))
      this.$message.success('已从素材库添加')
    },
    removeAt(index) {
      const next = this.value.slice()
      next.splice(index, 1)
      this.emitList(next)
    },
    moveUp(index) {
      if (index <= 0) return
      const next = this.value.slice()
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      this.emitList(next)
    },
    moveDown(index) {
      if (index >= this.value.length - 1) return
      const next = this.value.slice()
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      this.emitList(next)
    },
    onTabChange() {
      if (this.msgType === 'Link' && !this.linkList.length) {
        this.loadResources('Link')
      } else if (this.msgType === 'WeApp' && !this.weAppList.length) {
        this.loadResources('WeApp')
      } else if (this.msgType === 'NameCard' && this.wechatId) {
        this.loadContacts()
      }
    },
    loadResources(type) {
      // 同 MaterialPickerDialog：库内新旧 type 混存，按协议名查后端精确匹配会漏数字行
      resourcesList(1, 500, null)
        .then((res) => {
          const all = (res && res.code === 0 && res.data && res.data.rows) || []
          const parsed = filterMaterialsByType(all, type).map((item) => {
            const copy = { ...item }
            if (typeof copy.content === 'string') {
              try {
                copy.content = JSON.parse(copy.content)
              } catch (e) {
                /* keep */
              }
            }
            return copy
          })
          if (type === 'Link') this.linkList = parsed
          if (type === 'WeApp') this.weAppList = parsed
        })
        .catch(() => {
          if (type === 'Link') this.linkList = []
          if (type === 'WeApp') this.weAppList = []
        })
    },
    loadContacts() {
      if (!this.wechatId) return
      pageWwContacts({
        wxId: this.wechatId,
        contactType: 2,
        keyword: this.cardKeyword,
        page: 1,
        rows: 50
      })
        .then((res) => {
          this.contactRows = (res && res.data && res.data.rows) || []
        })
        .catch(() => {
          this.contactRows = []
        })
    },
    resetDraft() {
      this.textContent = ''
      this.clearMedia('Picture')
      this.clearMedia('Voice')
      this.clearMedia('Video')
      this.clearMedia('File')
      this.linkContent = null
      this.appContent = null
      this.nameCard = null
    },
    clearMedia(type) {
      if (type === 'Picture') {
        this.pictureUrl = ''
        this.pictureName = ''
        if (this.$refs.pictureInput) this.$refs.pictureInput.value = ''
      } else if (type === 'Voice') {
        this.voiceUrl = ''
        this.voicePlayUrl = ''
        this.voiceName = ''
        if (this.$refs.voiceInput) this.$refs.voiceInput.value = ''
      } else if (type === 'Video') {
        this.videoUrl = ''
        this.videoName = ''
        if (this.$refs.videoInput) this.$refs.videoInput.value = ''
      } else if (type === 'File') {
        this.fileContent = ''
        this.fileName = ''
        if (this.$refs.fileInput) this.$refs.fileInput.value = ''
      }
    },
    addMsg() {
      if (this.value.length >= this.max) {
        this.$message.warning('最多添加' + this.max + '条消息')
        return
      }
      let msg = { ContentType: this.msgType }
      let err = ''
      if (this.msgType === 'Text') {
        if (!this.textContent || !this.textContent.trim()) {
          err = '请填写文本'
        } else {
          msg.Content = this.textContent.trim()
          msg.desc = msg.Content
        }
      } else if (this.msgType === 'Picture') {
        if (!this.pictureUrl) err = '请上传图片'
        else {
          msg.Content = this.pictureUrl
          msg.desc = this.pictureName || '图片'
          msg.thumbUrl = this.pictureUrl
        }
      } else if (this.msgType === 'Voice') {
        if (!this.voiceUrl) err = '请上传语音'
        else {
          msg.Content = this.voiceUrl
          msg.desc = this.voiceName || '语音'
        }
      } else if (this.msgType === 'Video') {
        if (!this.videoUrl) err = '请上传视频'
        else {
          msg.Content = this.videoUrl
          msg.desc = this.videoName || '视频'
        }
      } else if (this.msgType === 'File') {
        if (!this.fileContent) err = '请上传文件'
        else {
          msg.Content = this.fileContent
          msg.desc = this.fileName || '文件'
          try {
            msg.jContent = JSON.parse(this.fileContent)
          } catch (e) {
            /* ignore */
          }
        }
      } else if (this.msgType === 'Link') {
        if (!this.linkContent || !this.linkContent.content) err = '请选择链接'
        else {
          msg.Content = JSON.stringify(this.linkContent.content)
          msg.jContent = this.linkContent.content
          msg.desc = this.linkContent.content.title || '链接'
          msg.thumbUrl = this.linkContent.content.thumbUrl
        }
      } else if (this.msgType === 'WeApp') {
        if (!this.appContent || !this.appContent.content) err = '请选择小程序'
        else {
          msg.Content = JSON.stringify(this.appContent.content)
          msg.jContent = this.appContent.content
          msg.desc = this.appContent.content.appName || '小程序'
          msg.thumbUrl = this.appContent.content.iconUrl
        }
      } else if (this.msgType === 'NameCard') {
        if (!this.nameCard || !this.nameCard.remoteId) err = '请选择名片联系人'
        else {
          msg.Content = String(this.nameCard.remoteId)
          msg.desc = this.nameCard.name || this.nameCard.remoteId
          msg.jContent = {
            name: this.nameCard.name,
            avatar: this.nameCard.avatar,
            remoteId: this.nameCard.remoteId
          }
        }
      }
      if (err) {
        this.$message.warning(err)
        return
      }
      this.emitList(this.value.concat([msg]))
      this.resetDraft()
    },
    uploadWithLoading(file, extra = {}) {
      const formdata = new FormData()
      formdata.append('myfile', file)
      Object.keys(extra).forEach((k) => formdata.append(k, extra[k]))
      const loading = this.$loading({
        lock: true,
        text: '文件上传中',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.7)'
      })
      return fileUpload(formdata)
        .then((res) => {
          loading.close()
          return res
        })
        .catch((err) => {
          loading.close()
          this.$message.error('上传失败：' + (err && err.message ? err.message : err))
          throw err
        })
    },
    chosePicture() {
      const files = this.$refs.pictureInput && this.$refs.pictureInput.files
      if (!files || !files[0]) return
      const file = files[0]
      if (file.type.indexOf('image') < 0) {
        this.$message.warning('请选择图片文件')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        this.$message.warning('图片不能超过 10MB')
        return
      }
      this.uploadWithLoading(file).then((res) => {
        this.pictureName = file.name
        this.pictureUrl = res.data.url
      })
    },
    async choseVoice() {
      const files = this.$refs.voiceInput && this.$refs.voiceInput.files
      if (!files || !files[0]) return
      const file = files[0]
      const ext = file.name.replace(/.+\./, '').toLowerCase()
      if (['mp3', 'amr'].indexOf(ext) < 0) {
        this.$message.warning('语音仅支持 mp3/amr')
        return
      }
      let duration = 0
      try {
        const formMp3 = new FormData()
        formMp3.append('myfile', file)
        if (ext === 'mp3') formMp3.append('isMp3ToAmr', false)
        else formMp3.append('isAmrToMp3', true)
        const playRes = await fileUpload(formMp3)
        if (playRes.data && playRes.data.url) {
          this.voicePlayUrl = playRes.data.url
          duration = await new Promise((resolve) => {
            const audio = new Audio(playRes.data.url)
            audio.addEventListener('loadedmetadata', () => resolve(Math.ceil(audio.duration || 0)))
            audio.addEventListener('error', () => resolve(0))
          })
        }
      } catch (e) {
        /* play url optional */
      }
      const extra = ext === 'mp3' ? { isMp3ToAmr: true } : { isAmrToMp3: false }
      this.uploadWithLoading(file, extra).then((res) => {
        let url = res.data.url
        if (duration > 0) url = url + '?duration=' + duration
        this.voiceUrl = url
        this.voiceName = file.name
      })
    },
    choseVideo() {
      const files = this.$refs.videoInput && this.$refs.videoInput.files
      if (!files || !files[0]) return
      const file = files[0]
      if (file.type !== 'video/mp4' && file.name.replace(/.+\./, '').toLowerCase() !== 'mp4') {
        this.$message.warning('仅支持 mp4')
        return
      }
      if (file.size > 100 * 1024 * 1024) {
        this.$message.warning('视频不能超过 100MB')
        return
      }
      this.uploadWithLoading(file).then((res) => {
        this.videoUrl = res.data.url
        this.videoName = file.name
      })
    },
    choseFile() {
      const files = this.$refs.fileInput && this.$refs.fileInput.files
      if (!files || !files[0]) return
      const file = files[0]
      if (file.size <= 0 || file.size > 100 * 1024 * 1024) {
        this.$message.warning('文件不能为空且不超过 100MB')
        return
      }
      this.uploadWithLoading(file).then((res) => {
        this.fileName = file.name
        this.fileContent = JSON.stringify({
          name: file.name,
          url: res.data.url,
          size: file.size,
          Source: 'pc'
        })
      })
    }
  }
}

</script>

<style lang="scss" scoped>
.msg-composer {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  .msg-list {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 10px;
    max-height: 160px;
    overflow: auto;
  }
  .msg-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    line-height: 28px;
    .msg-type {
      color: #909399;
      flex-shrink: 0;
    }
    .msg-desc {
      flex: 1;
      min-width: 0;
    }
  }
  .empty-hint {
    color: #909399;
    font-size: 12px;
    padding: 8px 0;
  }
  .add-box {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 0 8px 8px;

    :deep(.el-tabs) {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    :deep(.el-tabs__header) {
      margin: 0 0 8px;
    }

    :deep(.el-tabs__content) {
      flex: 1 1 auto;
      width: 100%;
      overflow: hidden;
    }

    :deep(.el-tab-pane) {
      width: 100%;
    }

    :deep(.el-textarea) {
      width: 100%;
    }
  }
  .add-actions {
    text-align: right;
    margin-top: 8px;
  }
  .upload-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 72px;
    flex-wrap: wrap;
  }
  .upload-btn {
    cursor: pointer;
    color: #576c95;
    font-size: 14px;
  }
  .preview-img {
    max-height: 80px;
    max-width: 120px;
  }
  .file-name {
    max-width: 180px;
    font-size: 12px;
  }
  .res-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 140px;
    overflow: auto;
  }
  .res-item {
    width: 110px;
    padding: 6px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    &.checked {
      border-color: #409eff;
      background: #ecf5ff;
    }
    .res-icon {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      object-fit: cover;
    }
  }
  .picker-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
