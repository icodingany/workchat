<template>
  <div class="fast-reply scroll">
    <!-- 快捷语 -->
    <div class="common-groups" v-for="(cps, index) in groups" :key="index">
      <!-- 分组 -->
      <div class="common-groups-tname">
        <span class="ellipsis" v-text="index"></span>
        <i class="fa fa-chevron-circle-down" title="显示/收起" aria-hidden="true" @click="toggleCommonList(index)"></i>
      </div>
      <!-- 组内消息 -->
      <div v-show="showGroups.indexOf(index) === -1">
        <div class="every-reply" v-for="(cp, index) in cps" :key="index" @click="sendMsg(cp)">
          <div class="cp-name">
            <span class="cpname ellipsis" v-text="cp.name"></span>
            <div class="show-cp" @click.stop="showCp(cp)">
              <i v-if="currentId !== cp.id && cp.ctype !== 5" class="fa fa-eye-slash" aria-hidden="true"></i>
              <i v-if="currentId === cp.id && cp.ctype !== 5" class="fa fa-eye" aria-hidden="true"></i>
            </div>
          </div>
          <div class="reply-detail" v-show="cp.id === currentId || cp._id === currentId">
            <p v-if="cp.ctype === 1" v-text="cp.content"></p>
            <img v-else-if="cp.ctype === 2" :src="cp.content" alt="图片" />
            <video v-else-if="cp.ctype === 3" :src="cp.content" controls></video>
            <audio v-else-if="cp.ctype === 4" :src="cp.content" controls></audio>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { getCommonTerms } from '@/api/httpApi'

export default {
  name: 'FastReply',
  data() {
    return {
      publicReply: [], // 公共术语
      currentId: -1, // 显示某个reply
      showGroups: [], // 要显示的分组
      addReplyVisible: false, // 显示dialog
      ruleForm: {
        ctype: 1, // 常用语类型 1.文本 2.图片 3.时评 4.语音 5.文件
        tname: '', // 组名
        name: '', // 备注
        content: '' // 常用语
      },
      rules: {
        tname: [
          { required: true, message: '请输入组名', trigger: 'blur' },
          { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' }
        ],
        name: [
          { required: true, message: '请输入备注', trigger: 'blur' },
          { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' }
        ],
        content: [
          { required: true, message: '请输入内容', trigger: 'blur' },
          { min: 1, max: 500, message: '长度在 1 到 500 个字符', trigger: 'blur' }
        ]
      }
    }
  },

  computed: {
    ...mapGetters({
      currentUser: 'currentUser'
    }),
    // reply分组
    groups() {
      let currentGroups = {}
      if (this.publicReply.length > 0) {
        for (const cr of this.publicReply) {
          if (currentGroups[cr.tname]) {
            currentGroups[cr.tname].push(cr)
          } else {
            let crs = []
            crs.push(cr)
            currentGroups[cr.tname] = crs
          }
        }
      }
      return currentGroups
    }
  },
  methods: {
    // 刷新公共术语
    refreshReply() {
      this.publicReply = []
      getCommonTerms(this.currentUser.UnionId)
        .then((res) => {
          if (res.code === 0) {
            this.publicReply = res.data
          }
        })
        .catch(() => {})
    },
    // 隐藏/显示分组
    toggleCommonList(index) {
      let id = this.showGroups.indexOf(index)
      if (id === -1) {
        this.showGroups.push(index)
      } else {
        this.showGroups.splice(id, 1)
      }
    },
    // 显示消息内容
    showCp(cp) {
      let cid = cp.id || cp._id
      if (this.currentId === cid) {
        this.currentId = -1
      } else {
        this.currentId = cp.id ? cp.id : cp._id
      }
    },
    // 发送常用消息（写入输入框；先切类型再填内容，避免清空后同 tick 内 DOM 不同步）
    sendMsg(msg) {
      let type = 'Text'
      switch (msg.ctype) {
        case 1:
          type = 'Text'
          break
        case 2:
          type = 'Picture'
          break
        case 3:
          type = 'Video'
          break
        case 4:
          type = 'Voice'
          break
        case 5:
          type = 'File'
          break
        default:
          type = 'Text'
          break
      }
      let content = msg.content
      if (type === 'File') {
        let fileName = msg.name + msg.content.replace(/.*\./, '.')
        content = JSON.stringify({ name: fileName, url: msg.content, size: '', Source: '公共术语' })
      }
      this.$store.commit('conversation/SET_CONTENT_TYPE', type)
      this.$nextTick(() => {
        this.$store.commit('conversation/SET_CONTENT', content)
      })
    }
  },
  created() {
    this.refreshReply()
  }
}
</script>

<style lang="scss" scoped>
.fast-reply {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;

  .common-groups {
    width: 100%;
    margin-bottom: 5px;
    .common-groups-tname {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f5f5f5;
      padding: 10px 0;
      // border: solid red 1px;
      span,
      i {
        color: black;
      }
      span {
        width: 70%;
        padding-left: 5px;
        font-size: 14px;
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      i {
        width: 10%;
        text-align: center;
        font-size: 16px;
        cursor: pointer;
        &:hover {
          color: #4bbcfb;
        }
      }
    }
    .every-reply {
      margin-top: 5px;
      margin-bottom: 5px;
      width: 90%;
      padding: 10px 0;
      // background: #f5f5f5;
      cursor: pointer;
      .cp-name {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .cpname {
          margin-left: 5px;
          font-size: 14px;
          width: 70%;
          color: #333333;
        }
        .remove,
        .show-cp {
          width: 10%;
          font-size: 14px;
          text-align: center;
          cursor: pointer;
        }
      }
      .reply-detail {
        padding: 10px;
      }

      p {
        margin-left: 3%;
        width: 94%;
        font-size: 12px;
        line-height: 20px;
        word-break: break-all;
      }
      img,
      audio,
      video {
        width: auto;
        height: auto;
        max-width: 80%;
        min-width: 80%;
        min-height: 40px;
        margin-left: 10%;
      }
    }
  }

  .selected {
    color: #3b7957;
  }
}
</style>

