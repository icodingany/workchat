<template>
  <div class="auto-reply">
    <!-- 提示|创建 -->
    <div class="auto-reply-title">
      <el-button type="primary" @click="showReplyDialog">新增回复</el-button>
      <p style="margin-left: 10px">是否启用：</p>
      <el-switch
        style="margin-left: 5px"
        v-model="replyState"
        active-color="#13ce66"
        inactive-color="#ff4949"
        @change="modifyAutoTask"
      ></el-switch>
      <el-row v-if="replyState" type="flex" align="middle">
        <el-input-number
          style="margin-left: 10px"
          :min="minNumber"
          :max="maxNumber"
          :disabled="!replyState"
          v-model="startTime"
        ></el-input-number>
        <el-input-number
          style="margin-left: 10px"
          :min="minNumber"
          :max="maxNumber"
          :disabled="!replyState"
          v-model="endTime"
        ></el-input-number>
        <el-button style="margin-left: 10px" type="primary" @click="modifyAutoTask">修改时间</el-button>
      </el-row>
    </div>

    <!-- 展示自动回复 -->
    <el-table style="margin-top: 10px" :data="autoReply" stripe border>
      <el-table-column label="匹配模式" prop="keyType" width="200" :formatter="keyTypeFomatter"></el-table-column>
      <el-table-column label="关键词" prop="keyWord"></el-table-column>
      <el-table-column label="消息类型" prop="resourceType" width="100" :formatter="formateMsgType"></el-table-column>
      <el-table-column label="回复内容" prop="returnString">
        <template #default="scope">
          <div
            :class="[
              { 'chat-link': isContentType(scope.row.resourceType, 'Link') },
              { 'chat-app': isContentType(scope.row.resourceType, 'WeApp') }
            ]"
            v-html="decodeChat(scope.row)"
          ></div>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="200">
        <template #default="scope">
          <span v-text="$filters.timeFilter(scope.row.createTime)"></span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="scope">
          <el-button type="primary" @click="showUpdateReply(scope.row)">编辑</el-button>
          <el-button type="warning" @click="removeReply(scope)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <Pagination
      v-show="totalNum > 0"
      :total="totalNum"
      v-model:page="pageNum"
      v-model:limit="pageSize"
      @pagination="queryConfig"
    />

    <!-- 添加关键词回复 -->
    <el-dialog
      title="新增回复内容"
      :close-on-click-modal="false"
      append-to-body
      class="add-reply-dialog"
      v-model="addReplyDialog"
    >
      <!-- content -->
      <div class="add-reply-content">
        <p class="key-word">匹配模式</p>
        <div class="key-type">
          <el-radio v-model="likeType" value="0">精准完全匹配</el-radio>
          <el-radio v-model="likeType" value="1">模糊包含匹配</el-radio>
          <el-radio v-model="likeType" value="2">模糊智能匹配</el-radio>
        </div>

        <p class="key-word">关键词</p>
        <el-input v-model.trim="keyWord" maxlength="20" show-word-limit clearable placeholder="输入关键词"></el-input>

        <p class="key-word">回复内容</p>
        <div class="set-conntent">
          <ul class="add-reply-aside">
            <li
              v-for="(mt, index) in msgTypes"
              :key="index"
              :class="{ 'li-selected': msgType === mt.type }"
              @click="toggleType(mt.type)"
            >
              <i class="fa" :class="mt.icon" aria-hidden="true"></i>
              {{ mt.name }}
            </li>
          </ul>

          <div class="write-content">
            <!-- 文本 -->
            <el-input
              v-if="msgType === 'Text'"
              v-model.trim="returnString"
              type="textarea"
              placeholder="请输入内容"
              maxlength="500"
              show-word-limit
              resize="none"
            ></el-input>

            <!-- 图片 -->
            <template v-if="msgType === 'Picture'">
              <template v-if="!pictureUrl">
                <img src="../../../assets/images/circles/tianjiatupian.png" alt="" />
                <label style="cursor: pointer; padding: 5px" for="addPicture">
                  <i class="el-icon-plus"></i>
                  <span style="color: #576c95; font-size: 14px">添加图片</span>
                </label>
                <input
                  v-show="false"
                  id="addPicture"
                  ref="pictureInputRef"
                  type="file"
                  accept=".jpg, .png, .jpeg"
                  @change="chosePicture"
                />
              </template>
              <template v-else>
                <img style="max-width: 400px; max-height: 190px" :src="pictureUrl" alt="图片" />
                <div style="display: flex; align-items: center; height: 32px">
                  <p style="margin-right: 5px" v-text="pictureName"></p>
                  <i style="cursor: pointer" class="el-icon-delete" @click="deletePicture"></i>
                </div>
              </template>
            </template>
            <!-- 语音 -->
            <template v-else-if="msgType === 'Voice'">
              <template v-if="!voiceUrl">
                <img src="../../../assets/images/circles/tianjiashipin.png" alt="" />
                <label style="cursor: pointer; padding: 5px" for="addVoice">
                  <i class="el-icon-plus"></i>
                  <span style="color: #576c95; font-size: 14px">添加语音</span>
                </label>
                <input
                  v-show="false"
                  id="addVoice"
                  ref="voiceInputRef"
                  type="file"
                  accept=".mp3, .amr"
                  @change="choseVoice"
                />
              </template>
              <template v-else>
                <audio
                  style="max-width: 400px; max-height: 190px; margin-top: 60px"
                  :src="voicePlayUrl"
                  controls
                ></audio>
                <div style="display: flex; align-items: center; height: 32px">
                  <p style="margin-right: 5px" v-text="voiceName"></p>
                  <i style="cursor: pointer" class="el-icon-delete" @click="deleteVoice"></i>
                </div>
              </template>
            </template>
            <!-- 视频 -->
            <template v-else-if="msgType === 'Video'">
              <template v-if="!videoUrl">
                <img src="../../../assets/images/circles/tianjiashipin.png" alt="" />
                <label style="cursor: pointer; padding: 5px" for="addPicture">
                  <i class="el-icon-plus"></i>
                  <span style="color: #576c95; font-size: 14px">添加视频</span>
                </label>
                <input
                  v-show="false"
                  id="addPicture"
                  ref="videoInputRef"
                  type="file"
                  accept=".mp4"
                  @change="choseVideo"
                />
              </template>
              <template v-else>
                <video style="max-width: 400px; max-height: 190px" :src="videoUrl" controls></video>
                <div style="display: flex; align-items: center; height: 32px">
                  <p style="margin-right: 5px" v-text="videoName"></p>
                  <i style="cursor: pointer" class="el-icon-delete" @click="deleteVideo"></i>
                </div>
              </template>
            </template>
            <!-- 链接 -->
            <template v-else-if="msgType === 'Link'">
              <div class="link-app-box">
                <div
                  v-for="(link, index) in linkList"
                  :key="index"
                  class="we-app-item"
                  :class="{ 'we-app-item-checked': linkContent.id === link.id }"
                  :title="link.content.title"
                  @click="linkContent = link"
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
                </div>
              </div>
            </template>
            <!-- 小程序 -->
            <template v-else-if="msgType === 'WeApp'">
              <div class="link-app-box">
                <div
                  v-for="(weApp, index) in weAppList"
                  :key="index"
                  class="we-app-item"
                  :class="{ 'we-app-item-checked': appContent.id === weApp.id }"
                  @click="appContent = weApp"
                >
                  <img class="we-app-img" :src="weApp.content.iconUrl" alt="" />
                  <p class="we-app-name ellipsis" v-text="weApp.content.appName"></p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- footer -->
      <template #footer>
        <span>
          <div>
            <el-checkbox v-model="moreWx" style="margin-left: 20px">选择多个微信匹配</el-checkbox>
            <el-select
              :disabled="!moreWx"
              v-model="wechats2send"
              style="margin: 0 165px 0 10px; width: 200px"
              clearable
              size="small"
              multiple
              collapse-tags
              placeholder="请选择微信"
            >
              <el-option
                v-for="wechat in wechats"
                :key="wechat.WxId"
                :label="wechat.Name"
                :value="wechat.WxId"
              ></el-option>
            </el-select>

            <el-button size="small" @click="resetData">取 消</el-button>
            <el-button v-if="reply2Updated" size="small" type="primary" @click="updateReplyById">立即更新</el-button>
            <el-button v-else type="primary" size="small" @click="createReply">立即添加</el-button>
          </div>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { fileUpload } from '@/utils/upload'
import {
  getAutoReplyList,
  addReply,
  deleteReply,
  updateReply,
  resourcesList,
  autoTaskUpdate,
  autoTaskDetailList
} from '@/api/httpApi'
import Pagination from '@/components/Pagination' // Secondary package based on el-pagination
import { decodeAutoReplyHtml } from '@/utils/autoReplyPreview'
import { isContentType } from '@/utils/chatMessageFields'

export default {
  name: 'AutoReply',
  data() {
    return {
      replyState: false, // 是否开启自动回复
      startTime: 0, // 默认之
      endTime: 23, // 默认之
      minNumber: 0, // 回复时间的最小值
      maxNumber: 23, // 回复时间的最大值
      moreWx: false, // 多微信模式
      wechats2send: [], // 微信
      autoReply: [],
      addReplyDialog: false, // 展示新增回复的dialog
      keyWord: '', // 关键词
      returnString: '', // 回复的内容
      reply2Updated: null, // 需要更新的回复,
      pageNum: 1,
      pageSize: 10,
      totalNum: 0,
      msgTypes: [
        {
          type: 'Text',
          icon: 'fa-file-text-o',
          name: '文本'
        },
        {
          type: 'Picture',
          icon: 'fa-file-image-o',
          name: '图片'
        },
        {
          type: 'Voice',
          icon: 'fa-microphone',
          name: '语音'
        },
        {
          type: 'Video',
          icon: 'fa-video-camera',
          name: '视频'
        },
        {
          type: 'Link',
          icon: 'fa-link',
          name: '链接'
        },
        {
          type: 'WeApp',
          icon: 'fa-product-hunt',
          name: '小程序'
        }
      ], // 消息类型
      msgType: 'Text', // 类型
      likeType: '1', // 默认 模糊包含匹配
      pictureUrl: '', // 要群发的图片url
      pictureName: '', // 要群发的图片名字
      voiceUrl: '', // 要群发的语音url
      voicePlayUrl: '', // 播放的语音
      voiceName: '', // 要群发的语音名字
      videoUrl: '', // 要群发的视频url
      videoName: '', // 要群发的视频名字
      linkContent: '', // 链接内容
      appContent: '', // 小程序内容
      linkList: [],
      weAppList: []
    }
  },
  components: { Pagination },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      wechats: 'conversation/wechats',
      currentWeChatId: 'conversation/currentWeChatId'
    })
  },
  watch: {
    currentWeChatId() {
      this.queryConfig()
      this.queryTaskState()
    }
  },
  created() {
    // 读取线上的配置
    this.queryConfig()
    this.queryTaskState()
  },
  methods: {
    isContentType,
    // 查询定时任务的状态
    queryTaskState() {
      if (!this.currentWeChatId) return
      autoTaskDetailList(this.currentWeChatId, 2001).then((res) => {
        if (res.data) {
          let stateData = res.data
          if (stateData.state === 0) {
            this.replyState = true
            let timeData = stateData.remarks.split(':')
            this.startTime = timeData[0]
            this.endTime = timeData[1]
          } else {
            this.replyState = false
            this.startTime = 0
            this.endTime = 23
          }
        } else {
          this.replyState = false
          this.startTime = 0
          this.endTime = 23
        }
      })
    },
    // 查询自动回复的配置文件
    queryConfig() {
      if (!this.currentWeChatId) return
      getAutoReplyList(this.currentWeChatId, '', '', '', this.pageNum, this.pageSize)
        .then((res) => {
          //   console.log(res)
          if (res.code === 0) {
            this.autoReply = res.data.rows
            this.totalNum = res.data.records
          }
        })
        .catch((err) => {
          this.$message.error(err.message)
        })
    },
    showReplyDialog() {
      if (!this.currentWeChatId) {
        this.$alert('请选选中一个微信！', '提示', { type: 'warning' })
        return
      }
      this.wechats.forEach((x) => {
        this.wechats2send.push(x.WxId)
      })
      this.addReplyDialog = true
    },
    queryResources(msgType) {
      resourcesList(1, 100, msgType).then((res) => {
        if (res.code === 0 && res.data.rows) {
          let jc = res.data.rows.map((x) => {
            let obj = { ...x }
            try {
              obj.content = JSON.parse(x.content)
            } catch (error) {
              console.log(error)
            }
            return obj
          })
          if (msgType === 'Link') {
            this.linkList = jc
          } else {
            this.weAppList = jc
          }
        } else {
          if (msgType === 'Link') {
            this.linkList = []
          } else {
            this.weAppList = []
          }
        }
      })
    },
    // 切换类型
    toggleType(type) {
      this.msgType = type
      this.queryResources(type)
    },
    // 选择图片
    chosePicture() {
      // 发送图片|视频|文件
      const fileObj = this.$refs.pictureInputRef.files // 文件对象
      // 如果有选中文件
      if (fileObj[0]) {
        const file = fileObj[0]
        // image/jpeg
        const isImage = file.type.indexOf('image') >= 0
        const isLt2M = file.size > 0 && file.size / 1024 / 1024 < 10

        if (!isImage) {
          this.$alert('图片格式不对！', '提示', { type: 'warning' })
          return
        }
        if (!isLt2M) {
          this.$alert('上传图片大小不能超过 10MB!', '提示', { type: 'warning' })
          return
        }
        // 验证通过
        const formdata = new FormData() // 上传
        formdata.append('myfile', file)
        const loading = this.$loading({
          lock: true,
          text: '文件上传中',
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        })
        fileUpload(formdata)
          .then((res) => {
            this.pictureName = file.name // 文件名
            this.pictureUrl = res.data.url
            loading.close()
          })
          .catch((err) => {
            this.$alert(`${err}`, '文件上传失败', { type: 'error' })
            loading.close()
          })
      }
    },
    // 删除图片
    deletePicture() {
      this.pictureName = ''
      this.pictureUrl = ''
    },
    // 选择视频
    choseVideo() {
      // 发送图片|视频|文件
      const fileObj = this.$refs.videoInputRef.files // 文件对象
      // 如果有选中文件
      if (fileObj[0]) {
        const file = fileObj[0]
        const isMP4 = file.type === 'video/mp4'
        const isLt2M = file.size > 0 && file.size / 1024 / 1024 < 20
        if (!isMP4) {
          this.$alert('上传视频只能是 MP4 格式!', '提示', { type: 'warning' })
          return
        }
        if (!isLt2M) {
          this.$alert('上传视频大小不能超过 20MB!', '提示', { type: 'warning' })
          return
        }
        // 验证通过
        const formdata = new FormData() // 上传
        formdata.append('myfile', file)
        const loading = this.$loading({
          lock: true,
          text: '文件上传中',
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        })
        fileUpload(formdata)
          .then((res) => {
            this.videoName = file.name // 文件名
            this.videoUrl = res.data.url
            loading.close()
          })
          .catch((err) => {
            this.$alert(`${err}`, '文件上传失败', { type: 'error' })
            loading.close()
          })
      }
    },
    // 删除视频
    deleteVideo() {
      this.videoUrl = ''
      this.videoName = ''
    },
    // 选择语音
    async choseVoice() {
      // 发送图片|视频|文件
      const fileObj = this.$refs.voiceInputRef.files // 文件对象
      // 如果有选中文件
      if (fileObj[0]) {
        const file = fileObj[0]
        const fileSize = file.size
        const fileName = file.name
        let duration = 0 // 语音时长

        const fileType = fileName.replace(/.+\./, '').toLowerCase()
        // 文件大于10M不能发送
        if (fileSize > 104857600 || fileSize <= 0) {
          this.$alert('语音大小不能超过 10MB!', '提示', { type: 'warning' })
          return
        }
        // 验证文件类型
        if (['amr', 'mp3'].indexOf(fileType) < 0) {
          this.$alert('语音格式不对!', '提示', { type: 'warning' })
          return
        }

        // 验证通过
        const formdata = new FormData() // 上传
        formdata.append('myfile', file)

        const loading = this.$loading({
          lock: true,
          text: '文件上传中',
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        })

        // 如果选择的是mp3文件，文件上传到服务器，转为amr，返回amr的地址
        // 如果选择的是amr文件，直接上传到服务器，返回amr的地址
        if (fileType === 'mp3') {
          formdata.append('isMp3ToAmr', true)
        } else if (fileType === 'amr') {
          formdata.append('isAmrToMp3', false)
        }

        // 计算语音时长
        let formDataMp3 = new FormData()
        formDataMp3.append('myfile', fileObj[0])
        if (fileType === 'mp3') {
          formDataMp3.append('isMp3ToAmr', false)
        } else if (fileType === 'amr') {
          formDataMp3.append('isAmrToMp3', true)
        }

        await new Promise((resolve, reject) => {
          fileUpload(formDataMp3).then((res) => {
            if (res.data && res.data.url) {
              this.voicePlayUrl = res.data.url
              let audioElement = new Audio(res.data.url)
              audioElement.addEventListener('loadedmetadata', function (_event) {
                duration = audioElement.duration
                resolve(duration)
              })
            } else {
              reject(false)
            }
          })
        })

        fileUpload(formdata)
          .then((res) => {
            let content = res.data.url

            duration = Math.ceil(duration)
            content = content + `?duration=${duration}`

            this.voiceUrl = content
            this.voiceName = fileName
            loading.close()
            this.$refs.voiceInputRef.value = ''
          })
          .catch((err) => {
            this.$message({
              message: '文件上传失败：' + err,
              type: 'error',
              duration: 0,
              showClose: true
            })
            loading.close()
          })
      }
    },
    // 删除语音
    deleteVoice() {
      this.voiceUrl = ''
      this.voiceName = ''
    },
    // 匹配模式
    keyTypeFomatter(row) {
      if (row.keyType === 0) {
        return '精准完全匹配'
      } else if (row.keyType === 1) {
        return '模糊包含匹配'
      } else if (row.keyType === 2) {
        return '模糊智能匹配'
      } else {
        return '未知'
      }
    },
    formateMsgType(row) {
      if (row.resourceType === 1) {
        return '文本'
      } else if (row.resourceType === 2) {
        return '图片'
      } else if (row.resourceType === 3) {
        return '语音'
      } else if (row.resourceType === 4) {
        return '视频'
      } else if (row.resourceType === 6) {
        return '链接'
      } else if (row.resourceType === 13) {
        return '小程序'
      }
      return row.resourceType
    },
    // 提交表单
    createReply() {
      // 如果通过验证 提交表单
      if (!this.keyWord.trim()) {
        this.$alert('关键词不能为空！', '提示', { type: 'warning' })
        return
      }
      const resourceTypeMap = {
        Text: 1,
        Picture: 2,
        Voice: 3,
        Video: 4,
        Link: 6,
        WeApp: 13
      }
      let replyMsg = this.returnString
      if (this.msgType === 'Picture') {
        replyMsg = this.pictureUrl
      } else if (this.msgType === 'Voice') {
        replyMsg = this.voiceUrl
      } else if (this.msgType === 'Video') {
        replyMsg = this.videoUrl
      } else if (this.msgType === 'Link') {
        replyMsg = JSON.stringify(this.linkContent.content)
      } else if (this.msgType === 'WeApp') {
        replyMsg = JSON.stringify(this.appContent.content)
      }

      if (!replyMsg.trim()) {
        this.$alert('回复内容不能为空！', '提示', { type: 'warning' })
        return
      }
      let wechatid = this.currentWeChatId
      if (this.moreWx) {
        if (this.wechats2send.length === 0) {
          this.$message.warning('至少选中一个微信！')
          return
        }
        wechatid = this.wechats2send.join(',')
      }
      // 添加
      addReply(
        wechatid,
        this.keyWord,
        this.likeType,
        resourceTypeMap[this.msgType],
        replyMsg
      )
        .then(() => {
          this.queryConfig()
          this.resetData()
        })
        .catch((err) => {
          this.$message.error(err.message)
        })
    },
    // 重置表单
    resetData() {
      this.addReplyDialog = false
      this.msgType = 'Text'
      this.keyWord = ''
      this.likeType = '1'
      this.returnString = ''
      this.pictureUrl = ''
      this.pictureName = ''
      this.voiceUrl = ''
      this.voicePlayUrl = ''
      this.voiceName = ''
      this.linkContent = ''
      this.appContent = ''
      this.reply2Updated = null
      this.moreWx = false
      this.wechats2send = []
    },
    // 删除自动回复
    removeReply(scope) {
      this.$confirm('确定删除 ?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          // 确认退出后，向服务端通知
          deleteReply(scope.row.id)
            .then(() => {
              this.queryConfig()
            })
            .catch((err) => {
              this.$message.error(err.message)
            })
        })
        .catch(() => {
          return false
        })
    },
    // 解析内容（委托 decodeChatHtml，经 autoReplyPreview 适配 returnString/resourceType）
    decodeChat(row) {
      return decodeAutoReplyHtml(row)
    },
    // 编辑回复内容
    showUpdateReply(row) {
      const msgTypeMap = {
        1: 'Text',
        2: 'Picture',
        3: 'Voice',
        4: 'Video',
        6: 'Link',
        13: 'WeApp'
      }
      this.reply2Updated = row
      this.keyWord = row.keyWord
      this.likeType = row.keyType.toString()
      this.msgType = msgTypeMap[row.resourceType]
      if (row.wechatid) {
        this.wechats2send = row.wechatid.split(',')
        if (this.wechats2send.length > 1) {
          this.moreWx = true
        }
      }
      if (row.resourceType === 1) {
        this.returnString = row.returnString
      } else if (row.resourceType === 2) {
        this.pictureUrl = row.returnString
      } else if (row.resourceType === 3) {
        this.voiceUrl = row.returnString
      } else if (row.resourceType === 4) {
        this.videoUrl = row.returnString
      } else if (row.resourceType === 6) {
        this.linkContent = JSON.parse(row.returnString)
        this.queryResources('Link')
      } else if (row.resourceType === 13) {
        this.appContent = JSON.parse(row.returnString)
        this.queryResources('WeApp')
      }
      this.addReplyDialog = true
    },
    // 更新关键词回复
    updateReplyById() {
      // 如果通过验证 提交表单
      if (!this.keyWord.trim()) {
        this.$alert('关键词不能为空！', '提示', { type: 'warning' })
        return
      }
      let replyMsg = this.returnString
      const resourceTypeMap = {
        Text: 1,
        Picture: 2,
        Voice: 3,
        Video: 4,
        Link: 6,
        WeApp: 13
      }
      if (this.msgType === 'Picture') {
        replyMsg = this.pictureUrl
      } else if (this.msgType === 'Voice') {
        replyMsg = this.voiceUrl
      } else if (this.msgType === 'Video') {
        replyMsg = this.videoUrl
      } else if (this.msgType === 'Link') {
        replyMsg = JSON.stringify(this.linkContent.content)
      } else if (this.msgType === 'WeApp') {
        replyMsg = JSON.stringify(this.appContent.content)
      }

      if (!replyMsg.trim()) {
        this.$alert('回复内容不能为空！', '提示', { type: 'warning' })
        return
      }
      let wechatid = this.currentWeChatId
      if (this.moreWx) {
        if (this.wechats2send.length === 0) {
          this.$message.warning('至少选中一个微信！')
          return
        }
        wechatid = this.wechats2send.join(',')
      }
      updateReply(
        this.reply2Updated.id,
        wechatid,
        this.keyWord,
        this.likeType,
        resourceTypeMap[this.msgType],
        replyMsg
      )
        .then(() => {
          this.queryConfig()
          this.resetData()
        })
        .catch((err) => {
          this.$message.error(err.message)
        })
    },
    // 修改任务状态
    modifyAutoTask() {
      if (this.startTime === this.endTime) {
        this.$message.warning('开始时间不能和结束时间一样！')
        return
      }
      if (this.replyState) {
        //   开启
        autoTaskUpdate(
          this.currentWeChatId,
          2001,
          0,
          `${this.startTime}:${this.endTime}`
        ).then((res) => {
          if (res.code === 0) {
            this.$message.success('修改状态成功！')
          }
        })
      } else {
        autoTaskUpdate(this.currentWeChatId, 2001, 1).then((res) => {
          if (res.code === 0) {
            this.$message.success('修改状态成功！')
          }
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.auto-reply {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .auto-reply-title {
    display: flex;
    // justify-content: space-between;
    align-items: center;
  }
}

:deep(.chat-link) {
  flex-direction: column;
  width: 300px;
  max-width: 100%;
  cursor: pointer;
  .link-title {
    font-size: 14px;
    font-weight: 600;
  }
  .link-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    .link-des {
      flex: auto;
      color: #aaaaaa;
      font-size: 10px;
      margin-right: 5px;
      overflow: hidden;
      text-overflow: ellipsis;
      word-break: break-all;
      word-wrap: break-word;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }
    .link-img {
      max-width: 50px;
      max-height: 50px;
      min-height: 50px;
      min-width: 50px;
      border-radius: 5px;
    }
  }
  .link-type {
    color: #aaaaaa;
    margin-top: 5px;
    text-align: start;
    border-top: solid #e8eaec 1px;
  }
}
:deep(.chat-app) {
  width: 300px;
  max-width: 100%;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  .app-des {
    display: flex;
    .app-icon {
      width: 20px;
      height: 20px;
    }
    .app-source {
      width: 100%;
      font-size: 12px;
      margin-left: 5px;
      color: gray;
    }
  }
  .app-title {
    width: 100%;
    height: 30px;
    font-size: 12px;
    font-weight: 600;
    line-height: 30px;
  }
  .app-img {
    align-self: center;
    max-width: 200px;
  }
  .app-typestr {
    height: 25px;
    margin-top: 5px;
    line-height: 25px;
    color: gray;
    text-align: start;
    border-top: solid #aaaaaa 1px;
  }
}
</style>
