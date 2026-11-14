<template>
  <div class="auto-reply">
    <!-- 提示|创建 -->
    <div class="auto-reply-title">
      <p style="margin-left: 10px">自动拉群</p>
      <el-switch
        style="margin-left: 5px"
        v-model="replyState"
        active-color="#13ce66"
        inactive-color="#ff4949"
        @change="modifyAutoTask"
      ></el-switch>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { autoTaskUpdate, autoTaskDetailList } from '@/api/httpApi'

export default {
  name: 'AutoTask',
  data() {
    return {
      replyState: false // 是否开启自动回复
    }
  },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      currentWeChatId: 'conversation/currentWeChatId'
    })
  },
  watch: {
    currentWeChatId() {
      this.queryTaskState()
    }
  },
  created() {
    // 读取线上的配置
    this.queryTaskState()
  },
  methods: {
    // 查询定时任务的状态
    queryTaskState() {
      if (!this.currentWeChatId) return
      autoTaskDetailList(this.currentWeChatId, 2002).then((res) => {
        if (res.data) {
          let stateData = res.data
          if (stateData.state === 0) {
            this.replyState = true
          } else {
            this.replyState = false
          }
        } else {
          this.replyState = false
        }
      })
    },
    // 修改任务状态
    modifyAutoTask() {
      if (this.replyState) {
        //   开启
        autoTaskUpdate(this.currentWeChatId, 2002, 0, '').then((res) => {
          if (res.code === 0) {
            this.$message.success('修改状态成功！')
          }
        })
      } else {
        console.log('关闭')
        autoTaskUpdate(this.currentWeChatId, 2002, 1, '').then((res) => {
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
