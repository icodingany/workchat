<template>
  <div class="friend-circle-send scroll">
    <!-- 设置发送内容 -->
    <div class="set-circle-type">
      <span class="base-tips">朋友圈类型</span>
      <el-radio-group v-model="circleType" class="can-not-select" >
        <el-radio-button value="text">纯文本</el-radio-button>
        <el-radio-button value="picture">图片</el-radio-button>
        <el-radio-button value="video">视频</el-radio-button>
        <el-radio-button value="link">链接</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 文本 -->
    <div class="set-circle-text">
      <span class="base-tips can-not-select">输入文本内容</span>
      <el-input
        v-model="text"
        type="textarea"
        placeholder="这一刻的想法..."
        style="height: auto; width: 50%"
        maxlength="500"
        show-word-limit
        :autosize="{ minRows: 6, maxRows: 6 }"
        resize="none"
      ></el-input>
    </div>

    <!-- 上传图片|视频 -->
    <div v-if="circleType !== 'link'" class="set-circle-other">
      <span class="base-tips can-not-select" v-text="'上传文件'"></span>
      <!-- 文本 -->
      <el-upload
        v-if="circleType === 'text'"
        :action="actionUrl"
        list-type="picture-card"
        class="el-upload-text"
        :data="upData"
        disabled
      >
        <i class="el-icon-plus"></i>
      </el-upload>
      <!-- 图片 -->
      <el-upload
        v-if="circleType === 'picture'"
        class="set-image-ulrs"
        :action="actionUrl"
        list-type="picture-card"
        accept=".jpg, .png, .jpeg"
        :class="{ hide: hideUpload }"
        :multiple="true"
        :limit="9"
        :file-list="imagesList"
        :data="upData"
        :show-file-list="showFileList"
        :on-change="handleImageChange"
        :before-upload="beforeImageUpload"
        :on-success="handleImageSuccess"
        :on-error="handleImageError"
        :on-preview="handlePictureCardPreview"
        :on-remove="handleImageRemove"
        :on-exceed="handleImageExceed"
      >
        <i class="el-icon-plus"></i>
      </el-upload>
      <!-- 上传视频 -->
      <el-upload
        v-if="circleType === 'video'"
        :action="actionUrl"
        list-type="picture-card"
        accept=".mp4"
        :file-list="videoList"
        :class="{ hide: hideVideoUpload }"
        :multiple="false"
        :limit="1"
        :data="upData"
        :show-file-list="showVideoList"
        :before-upload="beforeVideoUpload"
        :on-success="handleVideoSuccess"
        :on-error="handleVideoError"
      >
        <i class="el-icon-plus"></i>
        <template #file="{ file }">
          <div>
            <video class="el-upload-list__item-thumbnail" :src="file.url" alt></video>
            <span class="el-upload-list__item-actions">
              <span class="el-upload-list__item-preview" @click="handlePictureCardPreview(file)">
                <i class="el-icon-zoom-in"></i>
              </span>
              <span class="el-upload-list__item-delete" @click="handleVideoRemove(file)">
                <i class="el-icon-delete"></i>
              </span>
            </span>
          </div>
        </template>
      </el-upload>

      <div class="media-tip">
        <i style="color: #f5a623" class="el-icon-info"></i>
        <span style="margin-left: 5px; color: #909399" v-text="circleTypeTip[circleType]"></span>
      </div>
    </div>
    <!-- 设置链接 -->
    <template v-if="circleType === 'link'">
      <div class="set-circle-link">
        <span class="base-tips">链接缩略图地址</span>
        <el-input v-model="linkImg" placeholder="请输入链接缩略图地址" maxlength="200" minlength="12" clearable></el-input>
      </div>
      <div class="set-circle-link">
        <span class="base-tips">链接标题</span>
        <el-input
          v-model="linkTitle"
          type="textarea"
          placeholder="链接标题"
          maxlength="200"
          show-word-limit
          :autosize="{ minRows: 6, maxRows: 6 }"
          resize="none"
        ></el-input>
      </div>
      <div class="set-circle-link">
        <span class="base-tips">链接地址</span>
        <el-input v-model="linkUrl" placeholder="请输入链接地址" maxlength="200" minlength="12" clearable></el-input>
      </div>
    </template>

    <!-- 评论窗口 -->
    <div class="set-circle-comment">
      <!-- <span class="base-tips can-not-select">输入评论(可选)</span>
      <el-input
        disabled
        v-model="comment"
        type="textarea"
        placeholder="暂未实现"
        style="height: auto; width: 50%"
        maxlength="300"
        show-word-limit
        :autosize="{ minRows: 6, maxRows: 6 }"
        resize="none"
      ></el-input> -->
    </div>

    <!-- 谁可以看 -->
    <!-- <div class="visible-type">
      <span class="base-tips">可见的客户</span>
      <el-radio-group v-model="visibleType"  class="can-not-select">
        <el-radio-button value="common">公开</el-radio-button>
        <el-radio-button disabled value="partment">部分可见</el-radio-button>
      </el-radio-group>
    </div> -->
    <!-- </div> -->

    <!-- 操作 -->
    <div class="group-send-operation">
      <el-radio-group v-model="sendRadio">
        <el-radio style="width: 60px" :value="'rightNow'">立即开始</el-radio>
        <el-radio style="width: 60px" :value="'timing'">定时开始</el-radio>
        <el-date-picker
          v-model="refTime"
          style="width: 190px"
          type="datetime"
          placeholder="选择日期时间"
          prefix-icon="el-icon-date"
          clearable

          :disabled="sendRadio === 'rightNow'"
        ></el-date-picker>
      </el-radio-group>

      <el-checkbox v-model="moreWx" style="margin-left: 20px">选择多个微信发送</el-checkbox>
      <el-select
        :disabled="!moreWx"
        v-model="wechats2send"
        style="margin-left: 20px; width: 300px"

        clearable
        multiple
        collapse-tags
        placeholder="请选择微信"
      >
        <el-option
          v-for="wechat in wechats"
          :key="wechat.WxId"
          :disabled="!isWechatOnline(wechat)"
          :label="wechat.Name"
          :value="wechat.WxId"
        ></el-option>
      </el-select>

      <el-button
        style="margin-left: 20px"

        type="primary"
        :loading="loading"
        :disabled="loading"
        @click="postSNSNewsTask"
      >
        确认发送
      </el-button>

      <el-button style="margin-left: 10px" @click="materialPickerVisible = true">从素材库选择</el-button>
    </div>

    <MaterialPickerDialog
      v-model="materialPickerVisible"
      :accept="['Text', 'Picture', 'Video', 'Link']"
      title="从素材库选择（发朋友圈）"
      @select="onMaterialPicked"
    />

    <!-- 大图dialog -->
    <el-dialog class="dialog-visible" v-model="dialogVisible">
      <img v-if="circleType === 'picture'" class="circle-send-dialog" width="100%" :src="imageUrl" alt />
      <video v-else-if="circleType === 'video'" class="circle-send-dialog" :src="video" controls></video>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { postSnsTask } from '@/api/webSocketApi'
import { isWechatOnline } from '@/utils/wechat'
import MaterialPickerDialog from '@/components/MaterialPickerDialog.vue'
import { materialCircleFill } from '@/utils/resourcePayload'

export default {
  name: 'FriendCircleSend',
  components: {
    MaterialPickerDialog
  },
  data() {
    return {
      // 消息类型
      circleTypes: [
        {
          label: '纯文本',
          value: 'text'
        },
        {
          label: '图片',
          value: 'picture'
        },
        {
          label: '视频',
          value: 'video'
        },
        {
          label: '链接',
          value: 'link'
        }
      ],
      circleType: 'text', // 朋友圈类型
      circleTypeTip: {
        text: '纯文本模式，不能上传图片或视频！',
        picture: '只能上传jpg/png文件，且不超过2MB',
        video: '只能上传mp4文件，且不超过10秒',
        link: ''
      }, // 朋友圈类型提示
      visibleType: 'common', // 可见的客户
      text: '', // 文本

      moreWx: false, // 选择多个微信
      wechats2send: [], // 选择的微信
      sendRadio: 'rightNow', // 立即发送还是定时发送
      refTime: new Date().getTime(), // 定时发送的时间

      hideUpload: false, // 隐藏图片上传按钮
      showFileList: true, // 显示图片列表
      imagesList: [], // 图片回显

      showVideoList: true, // 显示图片列表
      hideVideoUpload: false, // 隐藏视频上传按钮
      videoList: [],
      upData: { myfile: '', packageName: 'pc' }, // 上传文件data
      imageUrl: '', // 大图url
      dialogVisible: false, // 显示大图

      imageUrls: [], // 图片
      video: '', // 视频
      comment: '', // 评论

      linkUrl: '', // 链接地址
      linkImg: '', // 链接述略图
      linkTitle: '', // 链接标题

      currentPage: 1, // 当前页
      pageSize: 50, // 每页消息数
      sending: false, // 发送状态
      friendIdChose: [], // 要发送的好友id
      friendsChose: [], // 已经选中的好友
      tags: [], // 标签
      search: '', // 搜索框的内容
      searchContent: [], // 搜索结果
      loading: false,
      materialPickerVisible: false
    }
  },
  computed: {
    ...mapGetters({
      actionUrl: 'actionUrl',
      currentUser: 'currentUser',
      wechats: 'conversation/wechats',
      currentWeChatId: 'conversation/currentWeChatId'
    })
  },
  watch: {
    currentWeChatId() {
      this.visibleType = 'common'
      this.currentPage = 1
      this.friendIdChose = []
    }
  },
  methods: {
    isWechatOnline,
    // 从素材库选择：按素材类型回填发圈表单（文案/图片/视频/链接）
    onMaterialPicked(row) {
      const patch = materialCircleFill(row)
      if (!patch) {
        this.$message.warning('该素材类型不支持发朋友圈')
        return
      }
      this.circleType = patch.circleType
      if (patch.text !== undefined) this.text = patch.text
      if (patch.imageUrls) this.imageUrls = patch.imageUrls
      if (patch.video) this.video = patch.video
      if (patch.linkUrl !== undefined) {
        this.linkUrl = patch.linkUrl
        this.linkTitle = patch.linkTitle
        this.linkImg = patch.linkImg
      }
      this.$message.success('已从素材库回填')
    },
    // 定时发送朋友圈
    sendCircleByJava(message) {
      addTaskTimeInfo(message)
        .then((res) => {
          if (res.code === 0) {
            this.$message({
              type: 'success',
              message: '创建定时任务成功！',
              duration: 1000
            })
          } else {
            this.$message({
              type: 'error',
              message: '创建定时任务失败！',
              duration: 1000
            })
          }
        })
        .catch((err) => {
          this.$message.error(err.message)
        })
    },
    // 定时群发 时间转换
    transformTime(times) {
      const date = new Date(times)
      const Y = date.getFullYear() + '-'
      const M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
      const D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ' '
      const h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':'
      const m = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()
      // let s = date.getSeconds()
      const time = Y + M + D + h + m
      return time
    },
    // 发朋友圈
    postSNSNewsTask() {
      // 表单验证
      if (this.circleType === 'text' && !this.text) {
        this.$message.warning('请设置文本内容!')
        return
      } else if (this.circleType === 'picture' && this.imageUrls.length === 0) {
        this.$message.warning('请设置图片!')
        return
      } else if (this.circleType === 'video' && !this.video) {
        this.$message.warning('请设置视频!')
        return
      } else if (this.circleType === 'link' && (!this.linkUrl || !this.linkImg || !this.linkTitle)) {
        this.$message.warning('请设置链接参数!')
        return
      }

      // 谁可以看
      const visible = {
        userIds: '',
        labelIds: ''
      }
      if (this.visibleType === 'partment') {
        if (this.friendIdChose.length === 0) {
          this.$message.warning('请至少选择一个好友！')
          return
        } else {
          visible.userIds = this.friendIdChose.join(',')
        }
      }

      // 附件
      let media = {
        Type: -1,
        Content: ''
      }
      switch (this.circleType) {
        case 'picture':
          media = { Type: 0, Content: this.imageUrls }
          break
        case 'video':
          media = { Type: 1, Content: [this.video] }
          break
        case 'link':
          media = { Type: 2, Content: [this.linkUrl, this.linkTitle, this.linkImg] }
          break
        default:
          break
      }

      // 立即发送还是定时发送
      if (this.sendRadio === 'rightNow') {
        const circle = {
          WxId: this.currentWeChatId,
          Content: this.text,
          Comment: this.comment,
          Visible: null,
          Media: null
        }
        if (this.visibleType === 'partment') {
          circle.Visible = visible
        }
        if (media.Type !== -1) {
          circle.Media = media
        }

        if (this.moreWx) {
          if (this.wechats2send.length === 0) {
            this.$message.warning('请至少选择一个微信!')
            return
          } else {
            for (const wechatId of this.wechats2send) {
              circle.WxId = wechatId
              postSnsTask(circle)
            }
          }
        } else {
          if (!this.currentWeChatId) {
            this.$message.warning('请选择微信!')
            return
          } else {
            postSnsTask(circle)
          }
        }
        this.$message.success('朋友圈任务已经下发！')
      } else {
        const message = {
          accountid: this.currentUser.UnionId,
          tasktype: 4, // 4发朋友圈 5批量加好友
          state: 1, // 状态1开启中0已完成
          wechatId: this.currentWeChatId, // 要执行的微信号
          execute_time: this.transformTime(this.refTime), // 执行时间
          content: this.text, // 内容
          comment: this.comment, // 针对发朋友圈
          restype: media.Type, // 资源类型(朋友圈:-1文本 0图片 1视频 2链接)
          remarks: ''
        }
        if (media.Type !== -1) {
          message.attachtype = media.Type // 附件类型
          message.attachtcontent = media.Content.join(',') // 附件内容
        }
        if (this.visibleType === 'partment') {
          message.whoinvisible = visible
        }

        if (this.moreWx) {
          if (this.wechats2send.length === 0) {
            this.$message.warning('请至少选择一个微信!')
            return
          } else {
            for (let index = 0; index < this.wechats2send.length; index++) {
              const sendData = JSON.parse(JSON.stringify(message))
              sendData.wechatId = this.wechats2send[index]
              let scbjt = setTimeout(() => {
                this.sendCircleByJava(sendData)
                clearTimeout(scbjt)
                scbjt = null
              }, index * 1000)
            }
          }
        } else {
          if (!this.currentWeChatId) {
            this.$message.warning('请选择微信!')
            return
          } else {
            this.sendCircleByJava(message)
          }
        }
        this.$message.success('朋友圈任务已经下发！')
      }
    },

    // 图片超出个数限制时的钩子
    handleImageExceed(files, fileList) {
      this.$message.warning(
        `当前限制选择 9 个文件，本次选择了 ${files.length} 个文件，共选择了 ${files.length + fileList.length} 个文件`
      )
    },
    // 图片改变
    handleImageChange(file, fileList) {
      if (fileList.length === 9) {
        this.showFileList = true
        this.hideUpload = true
      }
    },
    // 图片类型大小验证
    beforeImageUpload(file) {
      const isJPG = file.type === 'image/jpeg' || file.type === 'image/png'
      const isLt2M = file.size / 1024 / 1024 < 2
      if (!isJPG) {
        this.$message.warning('上传图片只能是 JPG|PNG 格式!')
      }
      if (!isLt2M) {
        this.$message.warning('上传图片大小不能超过 2MB!')
      }
      this.upData.myfile = file
      return isJPG && isLt2M
    },
    // 图片上传成功
    handleImageSuccess(res, file, fileList) {
      for (const fl of fileList) {
        if (fl.response) {
          fl.url = fl.response.data.url
        }
      }
      this.imagesList = fileList
      this.imageUrls.push(res.data.url)
    },
    // 图片上传失败
    handleImageError(err) {
      this.$alert(err, '文件上传失败', { type: 'error' })
      this.hideUpload = false
    },
    // 图片移除
    handleImageRemove(file, fileList) {
      const imgUrlId = this.imageUrls.indexOf(file.response.data.url)
      this.imageUrls.splice(imgUrlId, 1)
      this.hideUpload = false
      this.imagesList = fileList
    },
    // 视频格式和大小验证
    beforeVideoUpload(file) {
      const isMP4 = file.type === 'video/mp4'
      const isLt2M = file.size / 1024 / 1024 < 20
      if (!isMP4) {
        this.$message.warning('上传视频只能是 MP4 格式!')
      }
      if (!isLt2M) {
        this.$message.warning('上传视频大小不能超过 20MB!')
      }
      if (isMP4 && isLt2M) {
        this.upData.myfile = file
      }
      return isMP4 && isLt2M
    },
    // 视频上传成功
    handleVideoSuccess(res, file, fileList) {
      for (const fl of fileList) {
        if (fl.response) {
          fl.url = fl.response.data.url
        }
      }
      this.showVideoList = true
      this.hideVideoUpload = true
      this.videoList = fileList
      this.video = res.data.url
    },
    // 视频上传失败
    handleVideoError(err) {
      this.$alert(err, '文件上传失败', { type: 'error' })
      this.hideVideoUpload = false
      this.showVideoList = false
    },
    // 视频移除
    handleVideoRemove(file, fileList) {
      this.video = ''
      this.videoList = fileList
      this.hideVideoUpload = false
      this.showVideoList = false
    },
    // 图片|视频 大图展示
    handlePictureCardPreview(file) {
      if (this.circleType === 'picture') {
        this.imageUrl = file.url
      } else {
        this.video = file.url
      }
      this.dialogVisible = true
    }
  },
  mounted() {
    // 默认选择所有在线的微信
    this.wechats.forEach((x) => {
      if (isWechatOnline(x)) {
        this.wechats2send.push(x.WxId)
      }
    })
  }
}
</script>

<style lang="scss" scoped>
.base-tips {
  width: 110px;
  min-width: 110px;
  font-weight: 400px;
  margin-right: 10px;
  color: $font-color-1;
  display: inline-block;
}

.friend-circle-send {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;

  .set-circle-type,
  .set-circle-text,
  .visible-type,
  .set-circle-other,
  .set-circle-link,
  .set-circle-comment {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  .set-circle-other {
    position: relative;
    :deep(.el-upload-text) {
      .el-upload {
        cursor: not-allowed;
      }
    }
    :deep(.set-image-ulrs) {
      max-width: 50%;
    }
    .media-tip {
      position: absolute;
      bottom: -30px;
      left: 120px;
      padding: 5px;
      padding-left: 0;
    }
    :deep(.hide .el-upload--picture-card) {
      display: none;
    }
  }

  :deep(.set-circle-link) {
    .el-input--suffix {
      width: 50%;
    }
    .el-textarea {
      width: 50%;
    }
  }

  .set-circle-comment {
    margin-top: 40px;
  }

  .group-send-operation {
    margin-bottom: 20px;
    display: flex;
    align-items: center;
  }
}
</style>
