<template>
  <div class="group-assistant-send">
    <el-row type="flex" align="middle" style="margin-bottom: 10px">
      <el-radio-group v-model="sendType">
        <el-radio-button value="customers">我的客户</el-radio-button>
        <el-radio-button value="friends">企业联系人</el-radio-button>
        <el-radio-button value="rooms">群聊</el-radio-button>
      </el-radio-group>
      <el-input
        style="width: 300px; margin-left: 10px"
        placeholder="请输入昵称"
        prefix-icon="el-icon-search"
        clearable
        maxlength="20"
        show-word-limit
        v-model.trim.lazy="searchName"
      ></el-input>
    </el-row>

    <div ref="tableWrap" class="table-wrap">
      <el-table
        ref="multipleTable"
        :data="tableData"
        stripe
        border
        style="width: 100%"
        highlight-current-row
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="index" :index="indexMethod" label="序号" :width="tableCompact ? 56 : 100"></el-table-column>
        <el-table-column label="昵称" prop="Name" min-width="140"></el-table-column>
        <el-table-column v-if="!tableCompact" label="备注名" prop="Alias"></el-table-column>
        <el-table-column v-if="!tableCompact" label="性别" prop="Gender"></el-table-column>
        <el-table-column label="群成员人数" :width="tableCompact ? 100 : undefined">
          <template #default="{ row }">
            <span v-if="row.Members" v-text="row.Members.length"></span>
          </template>
        </el-table-column>
        <el-table-column type="selection" label="全选" align="center" :width="tableCompact ? 44 : undefined"></el-table-column>
      </el-table>
    </div>

    <div class="group-send-operation">
      <el-button type="primary" @click="sendNext">下一步</el-button>
    </div>

    <el-dialog
      class="group-send-dialog"
      title="设置群发消息"
      :close-on-click-modal="false"
      v-model="editDialg"
      width="720px"
    >
      <MsgComposer v-model="msgList" :wechat-id="currentWeChatId" />

      <MassSendTaskConfig :task-form="taskConfig" />

      <template #footer>
        <div class="group-send-footer">
          <el-button @click="resetData">取 消</el-button>
          <el-button type="primary" @click="sureSend">发 送</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { addTaskTimeInfo } from '@/api/httpApi'
import MsgComposer from '@/components/MsgComposer.vue'
import MassSendTaskConfig from '@/views/admin/components/MassSendTaskConfig.vue'
import { messagesToReplyContent } from '@/components/msgComposerHelpers'
import { groupTableCompact } from '@/utils/groupTableLayout'

function createDefaultTaskConfig() {
  return {
    remarks: '',
    startTimeType: 'immediate',
    scheduledTime: Date.now(),
    // 群发走拟真人节奏（防企微风控行为风控），对齐个微端 10s 默认
    friendInterval: { min: 10, max: 20 },
    messageInterval: { min: 5, max: 10 }
  }
}

export default {
  name: 'GroupAssistantSend',
  components: {
    MsgComposer,
    MassSendTaskConfig
  },
  data() {
    return {
      searchName: '',
      sendType: 'customers',
      roomsList: [],
      wxid2Send: [],
      editDialg: false,
      msgList: [],
      taskConfig: createDefaultTaskConfig(),
      tableCompact: false
    }
  },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      currentWeChatId: 'conversation/currentWeChatId',
      conversations: 'conversation/currentConvs',
      customers: 'conversation/currentCustomers',
      currentContacts: 'conversation/currentContacts'
    }),
    tableData() {
      let td = []
      if (this.sendType === 'customers') {
        td = this.customers
      } else if (this.sendType === 'friends') {
        td = this.currentContacts
      } else {
        td = this.roomsList
      }
      if (this.searchName) {
        td = td.filter((x) => {
          return x.Name && x.Name.indexOf(this.searchName) >= 0
        })
      }
      return td
    }
  },
  watch: {
    currentWeChatId() {
      this.roomsList = this.conversations.filter((x) => x.Members)
    }
  },
  created() {
    this.roomsList = this.conversations.filter((x) => x.Members)
  },
  mounted() {
    // 企微客户端内嵌网页/手机 H5 下主区窄，UA 判不到，按容器实际宽度切紧凑布局
    if (typeof ResizeObserver !== 'undefined' && this.$refs.tableWrap) {
      this._tableRO = new ResizeObserver((entries) => {
        const width = entries && entries[0] ? entries[0].contentRect.width : 0
        this.tableCompact = groupTableCompact(width)
      })
      this._tableRO.observe(this.$refs.tableWrap)
    } else {
      this.tableCompact = groupTableCompact(window.innerWidth)
    }
  },
  beforeUnmount() {
    if (this._tableRO) {
      this._tableRO.disconnect()
      this._tableRO = null
    }
  },
  methods: {
    indexMethod(index) {
      return index + 1
    },
    handleSelectionChange(val) {
      this.wxid2Send = val
    },
    sendNext() {
      if (!this.currentWeChatId) {
        this.$message.warning('请先选择一个微信！')
        return
      }
      if (this.wxid2Send.length === 0) {
        this.$message.warning('请至少选择一个对象！')
        return
      }
      this.taskConfig = createDefaultTaskConfig()
      this.editDialg = true
    },
    resetData() {
      this.editDialg = false
      this.msgList = []
      this.wxid2Send = []
      this.taskConfig = createDefaultTaskConfig()
      if (this.$refs.multipleTable) {
        this.$refs.multipleTable.clearSelection()
      }
    },
    transformTime(times) {
      const date = new Date(times)
      const pad = (n) => (n < 10 ? '0' + n : '' + n)
      return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        ' ' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes()) +
        ':' +
        pad(date.getSeconds())
      )
    },
    sureSend() {
      if (this.msgList.length === 0) {
        this.$message.warning('请设置群发内容！')
        return
      }
      const cfg = this.taskConfig
      let startTime = Date.now()
      if (cfg.startTimeType === 'scheduled') {
        if (!cfg.scheduledTime) {
          this.$message.warning('请设置定时发送时间')
          return
        }
        startTime = cfg.scheduledTime
      }
      const message = {
        accountid: this.currentUser.UnionId,
        tasktype: this.sendType === 'customers' ? 1 : this.sendType === 'friends' ? 2 : 3,
        state: 1,
        wechatId: this.currentWeChatId,
        wechatList: this.wxid2Send.map((x) => x.RemoteId),
        execute_time: this.transformTime(startTime),
        content: messagesToReplyContent(this.msgList),
        remarks: cfg.remarks || '',
        friend_interval_min: cfg.friendInterval.min,
        friend_interval_max: cfg.friendInterval.max,
        message_interval_min: cfg.messageInterval.min,
        message_interval_max: cfg.messageInterval.max,
        between_time: cfg.friendInterval.min
      }
      addTaskTimeInfo(message)
        .then((res) => {
          if (res.code === 0) {
            this.$message({ type: 'success', message: '创建定时任务成功！', duration: 1000 })
            this.resetData()
          } else {
            this.$message({ type: 'error', message: '创建定时任务失败！', duration: 1000 })
          }
        })
        .catch((err) => {
          this.$message.error(err.message)
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.group-assistant-send {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .group-send-operation {
    padding: 7px 15px 5px;
    display: flex;
    justify-content: flex-end;
  }

  .group-send-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }
}
</style>
