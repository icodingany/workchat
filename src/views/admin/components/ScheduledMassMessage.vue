<template>
  <div class="ww-admin-page">
    <div class="tip-box">调度按秒检查到期子任务；好友/群与消息间隔在创建时写入各条子任务执行时间。</div>
    <div class="set-parameters">
      <el-input v-model="wechatId" clearable placeholder="企微号 WxId" class="filter-item" />
      <el-select v-model="tasktype" clearable placeholder="对象类型" class="filter-item">
        <el-option label="全部" value="" />
        <el-option label="群发客户" :value="1" />
        <el-option label="群发同事" :value="2" />
        <el-option label="群发群聊" :value="3" />
      </el-select>
      <el-select v-model="state" clearable placeholder="状态" class="filter-item">
        <el-option label="全部" value="" />
        <el-option label="开启中" :value="1" />
        <el-option label="已完成" :value="0" />
        <el-option label="已暂停" :value="-1" />
        <el-option label="已取消" :value="2" />
      </el-select>
      <el-button type="primary" @click="queryData">查询</el-button>
      <el-button type="success" @click="openCreate">新建</el-button>
    </div>

    <div v-if="mobile" v-loading="loading" class="mobile-admin-cards">
      <div v-if="!loading && !tableData.length" class="empty-tip">暂无定时群发任务</div>
      <article v-for="row in tableData" :key="row.id" class="mobile-admin-card">
        <header class="mobile-admin-card__head">
          <strong class="mobile-admin-card__title">{{ row.wechatId || '-' }}</strong>
          <span class="mobile-admin-card__badge">{{ stateMap[row.state] || '-' }}</span>
        </header>
        <dl class="mobile-admin-card__rows">
          <div class="mobile-admin-card__row">
            <dt>对象类型</dt>
            <dd>{{ tasktypeMap[row.tasktype] || '-' }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>执行时间</dt>
            <dd>{{ row.execute_time || '-' }}</dd>
          </div>
        </dl>
        <div v-if="row.state === 1 || row.state === -1" class="mobile-admin-card__btns">
          <el-button v-if="row.state === 1" link @click="changeState(row, -1)">暂停</el-button>
          <el-button v-if="row.state === -1" link @click="changeState(row, 1)">恢复</el-button>
          <el-button link @click="changeState(row, 2)">取消</el-button>
        </div>
      </article>
    </div>

    <el-table v-else v-loading="loading" :data="tableData" stripe border height="100%">
      <el-table-column prop="wechatId" label="企微号" min-width="140" show-overflow-tooltip />
      <el-table-column label="对象类型" width="110" align="center">
        <template #default="scope">{{ tasktypeMap[scope.row.tasktype] || '-' }}</template>
      </el-table-column>
      <el-table-column prop="execute_time" label="执行时间" width="160" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="scope">{{ stateMap[scope.row.state] || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="scope">
          <el-button
            v-if="scope.row.state === 1"
            link
            @click="changeState(scope.row, -1)"
          >暂停</el-button>
          <el-button
            v-if="scope.row.state === -1"
            link
            @click="changeState(scope.row, 1)"
          >恢复</el-button>
          <el-button
            v-if="scope.row.state === 1 || scope.row.state === -1"
            link
            @click="changeState(scope.row, 2)"
          >取消</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!mobile && !loading && total === 0" class="empty-tip">暂无定时群发任务</div>
    <el-pagination
      :current-page="pageNo"
      :page-sizes="[20, 40, 60]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />

    <el-dialog
      title="新增群发消息"
      v-model="dialogVisible"
      width="800px"
      :modal="false"
      :close-on-click-modal="false"
    >
      <el-steps :active="currentStep" align-center finish-status="success" class="send-steps">
        <el-step title="选择账号" />
        <el-step title="一键群发" />
      </el-steps>

      <!-- Step0：选账号与接收人 -->
      <div v-show="currentStep === 0" class="step-panel">
        <el-form label-width="100px">
          <el-form-item label="企微号" required>
            <el-select v-model="form.wechatId" filterable clearable placeholder="请选择" style="width: 100%">
              <el-option
                v-for="item in wxOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="对象类型" required>
            <el-radio-group v-model="form.sendType" @change="onSendTypeChange">
              <el-radio value="customers">客户</el-radio>
              <el-radio value="friends">同事</el-radio>
              <el-radio value="rooms">群聊</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="接收人" required>
            <!-- el-form-item__content 是 flex：多个直接子元素会并排一行把表格挤扁，须包一层块级容器 -->
            <div class="picker-area">
              <div class="picker-toolbar">
                <el-input
                  v-model="pickerKeyword"
                  clearable
                  placeholder="昵称/备注"
                  size="small"
                  style="width: 180px"
                  @keyup.enter="loadRecipients"
                />
                <el-button size="small" @click="loadRecipients">刷新列表</el-button>
              </div>
              <el-table
                ref="recipientTable"
                v-loading="pickerLoading"
                :data="recipientRows"
                height="220"
                border
                size="small"
                @selection-change="onSelectionChange"
              >
                <el-table-column type="selection" width="45" />
                <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
                <el-table-column prop="remoteId" label="RemoteId" min-width="120" show-overflow-tooltip />
              </el-table>
              <div v-if="!pickerLoading && recipientRows.length === 0" class="form-hint">
                暂无数据，请先在客服端同步通讯录/客户/群
              </div>
              <div class="form-hint">已选 {{ selectedRemoteIds.length }} 人</div>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step1：消息 + 任务配置 -->
      <div v-show="currentStep === 1" class="step-panel">
        <div class="message-block">
          <div class="block-title">消息内容</div>
          <MsgComposer v-model="form.messages" :wechat-id="form.wechatId" />
        </div>
        <MassSendTaskConfig :task-form="taskConfig" />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button v-if="currentStep === 0" type="primary" @click="nextStep">下一步</el-button>
          <template v-else>
            <el-button @click="currentStep = 0">上一步</el-button>
            <el-button type="primary" :loading="saving" @click="submitCreate">确 定</el-button>
          </template>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  taskTimePageList,
  taskTimeAdd,
  taskTimeUpdateState,
  listNewFriendReply,
  pageWwContacts,
  pageWwChatRooms
} from '@/api/httpApiAdmin'
import MsgComposer from '@/components/MsgComposer.vue'
import MassSendTaskConfig from '@/views/admin/components/MassSendTaskConfig.vue'
import { messagesToReplyContent } from '@/components/msgComposerHelpers'
import { isMobile } from '@/utils/deviceDetector'

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
  name: 'ScheduledMassMessage',
  components: { MsgComposer, MassSendTaskConfig },
  data() {
    return {
      loading: false,
      saving: false,
      wechatId: '',
      tasktype: '',
      state: '',
      tableData: [],
      pageNo: 1,
      pageSize: 20,
      total: 0,
      tasktypeMap: {
        1: '群发客户',
        2: '群发同事',
        3: '群发群聊',
        4: '发朋友圈'
      },
      stateMap: {
        1: '开启中',
        0: '已完成',
        '-1': '已暂停',
        2: '已取消'
      },
      dialogVisible: false,
      currentStep: 0,
      wxOptions: [],
      pickerLoading: false,
      pickerKeyword: '',
      recipientRows: [],
      selectedRemoteIds: [],
      form: {
        wechatId: '',
        sendType: 'customers',
        messages: []
      },
      taskConfig: createDefaultTaskConfig()
    }
  },
  computed: {
    mobile() {
      return isMobile()
    }
  },
  created() {
    this.queryData()
  },
  methods: {
    queryData() {
      this.pageNo = 1
      this.fetchList()
    },
    fetchList() {
      this.loading = true
      taskTimePageList({
        tasktype: this.tasktype,
        wechatId: this.wechatId,
        state: this.state,
        page: this.pageNo,
        rows: this.pageSize
      })
        .then((res) => {
          if (res && res.code === 0 && res.data) {
            this.tableData = res.data.rows || []
            this.total = res.data.records || 0
          } else {
            this.$message.error((res && res.msg) || '查询失败')
          }
        })
        .catch(() => {
          this.$message.error('查询失败')
        })
        .finally(() => {
          this.loading = false
        })
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.fetchList()
    },
    handleCurrentChange(page) {
      this.pageNo = page
      this.fetchList()
    },
    changeState(row, state) {
      taskTimeUpdateState(row.id, state)
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('已更新')
            this.fetchList()
          } else {
            this.$message.error((res && res.msg) || '更新失败')
          }
        })
        .catch(() => {
          this.$message.error('更新失败')
        })
    },
    openCreate() {
      this.form = {
        wechatId: '',
        sendType: 'customers',
        messages: []
      }
      this.taskConfig = createDefaultTaskConfig()
      this.selectedRemoteIds = []
      this.pickerKeyword = ''
      this.recipientRows = []
      this.currentStep = 0
      this.dialogVisible = true
      this.loadWxOptions()
      this.loadRecipients()
    },
    nextStep() {
      if (!this.form.wechatId) {
        this.$message.warning('请选择企微号')
        return
      }
      if (!this.selectedRemoteIds.length) {
        this.$message.warning('请选择接收人')
        return
      }
      this.currentStep = 1
    },
    loadWxOptions() {
      listNewFriendReply()
        .then((res) => {
          const rows = (res && res.data) || []
          this.wxOptions = rows
            .filter((r) => r && r.wechatId)
            .map((r) => ({
              value: r.wechatId,
              label: r.wechatName ? `${r.wechatName} (${r.wechatId})` : r.wechatId
            }))
        })
        .catch(() => {
          this.wxOptions = []
        })
    },
    onSendTypeChange() {
      this.selectedRemoteIds = []
      if (this.$refs.recipientTable) {
        this.$refs.recipientTable.clearSelection()
      }
      this.loadRecipients()
    },
    loadRecipients() {
      if (!this.form.wechatId) {
        this.recipientRows = []
        return
      }
      this.pickerLoading = true
      const wxId = this.form.wechatId
      const keyword = this.pickerKeyword
      let req
      if (this.form.sendType === 'rooms') {
        req = pageWwChatRooms({ wxId, keyword, page: 1, rows: 100 })
      } else {
        const contactType = this.form.sendType === 'friends' ? 1 : 2
        req = pageWwContacts({ wxId, contactType, keyword, page: 1, rows: 100 })
      }
      req
        .then((res) => {
          if (res && res.code === 0 && res.data) {
            this.recipientRows = res.data.rows || []
          } else {
            this.recipientRows = []
          }
        })
        .catch(() => {
          this.recipientRows = []
        })
        .finally(() => {
          this.pickerLoading = false
        })
    },
    onSelectionChange(rows) {
      this.selectedRemoteIds = (rows || []).map((r) => String(r.remoteId)).filter(Boolean)
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
    submitCreate() {
      if (!this.form.messages || !this.form.messages.length) {
        this.$message.warning('请至少添加一条群发消息')
        return
      }
      const cfg = this.taskConfig
      let executeAt = Date.now()
      if (cfg.startTimeType === 'scheduled') {
        if (!cfg.scheduledTime) {
          this.$message.warning('请设置定时发送时间')
          return
        }
        executeAt = cfg.scheduledTime
      }
      if (!cfg.friendInterval || !cfg.messageInterval) {
        this.$message.warning('请设置发送间隔')
        return
      }
      const tasktype =
        this.form.sendType === 'customers' ? 1 : this.form.sendType === 'friends' ? 2 : 3
      this.saving = true
      taskTimeAdd({
        tasktype,
        state: 1,
        wechatId: this.form.wechatId,
        wechatList: this.selectedRemoteIds,
        execute_time: this.transformTime(executeAt),
        content: messagesToReplyContent(this.form.messages),
        remarks: cfg.remarks || '',
        friend_interval_min: cfg.friendInterval.min,
        friend_interval_max: cfg.friendInterval.max,
        message_interval_min: cfg.messageInterval.min,
        message_interval_max: cfg.messageInterval.max,
        between_time: cfg.friendInterval.min
      })
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('创建成功')
            this.dialogVisible = false
            this.queryData()
          } else {
            this.$message.error((res && res.msg) || '创建失败')
          }
        })
        .catch(() => {
          this.$message.error('创建失败')
        })
        .finally(() => {
          this.saving = false
        })
    }
  },
  watch: {
    'form.wechatId'() {
      if (this.dialogVisible) {
        this.loadRecipients()
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.ww-admin-page {
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  .tip-box {
    margin-bottom: 10px;
    padding: 8px 12px;
    background: #f4f4f5;
    color: #606266;
    font-size: 13px;
    border-radius: 4px;
  }
  .set-parameters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
    .filter-item {
      width: 180px;
    }
  }
  .el-table {
    flex: 1;
  }
  .empty-tip,
  .form-hint {
    margin: 8px 0;
    color: #909399;
    font-size: 13px;
  }
  .picker-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .picker-area {
    width: 100%;
  }
  .el-pagination {
    margin-top: 12px;
    text-align: right;
  }
  .send-steps {
    margin-bottom: 20px;
  }
  .step-panel {
    min-height: 280px;
  }
  .message-block {
    margin-bottom: 16px;
    .block-title {
      margin-bottom: 8px;
      color: #606266;
      font-weight: 500;
    }
  }
  .dialog-footer {
    text-align: right;
  }
}
</style>
