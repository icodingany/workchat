<template>
  <div class="ww-admin-page">
    <div class="tip-box">历史好友不会做新增好友自动回复（以前加过，删除后再添加的算历史好友）。</div>

    <div v-if="mobile" v-loading="loading" class="mobile-admin-cards">
      <div v-if="!loading && !tableData.length" class="empty-tip">暂无数据</div>
      <article v-for="row in tableData" :key="row.wechatId" class="mobile-admin-card">
        <header class="mobile-admin-card__head">
          <strong class="mobile-admin-card__title">{{ row.wechatName || row.wechatId || '-' }}</strong>
          <el-button link type="primary" @click="openDialog(row)">设置</el-button>
        </header>
        <dl class="mobile-admin-card__rows">
          <div class="mobile-admin-card__row">
            <dt>欢迎语</dt>
            <dd>{{ summarize(row.replyContent) || '-' }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>生效时段</dt>
            <dd>{{ (row.startTime || '00:00') + ' ~ ' + (row.endTime || '00:00') }}</dd>
          </div>
        </dl>
        <div class="mobile-admin-card__actions">
          <label class="mobile-admin-card__switch">
            <span>启用欢迎语</span>
            <el-switch
              :model-value="row.enabled === 1"
              @change="(val) => onToggleEnabled(row, val)"
            />
          </label>
          <label class="mobile-admin-card__switch">
            <span>自动通过好友</span>
            <el-switch
              :model-value="row.autoAcceptState === 0"
              @change="(val) => onToggleAutoAccept(row, val)"
            />
          </label>
        </div>
      </article>
    </div>

    <el-table v-else v-loading="loading" :data="tableData" stripe border height="100%">
      <el-table-column label="企微号" min-width="180">
        <template #default="scope">
          <div class="wx-cell">
            <div>
              <div>{{ scope.row.wechatName || '-' }}</div>
              <div class="sub">{{ scope.row.wechatId }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="欢迎语" min-width="220" show-overflow-tooltip>
        <template #default="scope">
          {{ summarize(scope.row.replyContent) }}
        </template>
      </el-table-column>
      <el-table-column label="生效时段" width="140" align="center">
        <template #default="scope">
          {{ (scope.row.startTime || '00:00') + ' ~ ' + (scope.row.endTime || '00:00') }}
        </template>
      </el-table-column>
      <el-table-column label="启用欢迎语" width="120" align="center">
        <template #default="scope">
          <el-switch
            :model-value="scope.row.enabled === 1"
            @change="(val) => onToggleEnabled(scope.row, val)"
          />
        </template>
      </el-table-column>
      <el-table-column label="自动通过好友请求" width="150" align="center">
        <template #default="scope">
          <el-switch
            :model-value="scope.row.autoAcceptState === 0"
            @change="(val) => onToggleAutoAccept(scope.row, val)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center">
        <template #default="scope">
          <el-button link @click="openDialog(scope.row)">设置</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      title="设置新增好友欢迎语"
      v-model="dialogVisible"
      width="640px"
      :modal-append-to-body="true"
      :modal="false"
      append-to-body
    >
      <el-form label-width="100px" class="new-friend-reply-form">
        <el-form-item label="欢迎语" required class="new-friend-reply-form__composer">
          <MsgComposer v-model="form.messages" :wechat-id="currentWechatId" />
        </el-form-item>
        <el-form-item label="生效时段">
          <el-time-select
            v-model="form.startTime"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="开始"
            style="width: 120px"
          />
          <span style="margin: 0 8px">~</span>
          <el-time-select
            v-model="form.endTime"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="结束"
            style="width: 120px"
          />
          <div class="form-hint">均为 00:00 表示全天</div>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" :loading="saving" @click="saveForm">保 存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  listNewFriendReply,
  saveNewFriendReply,
  toggleNewFriendReply,
  autoTaskUpdate
} from '@/api/httpApiAdmin'
import MsgComposer from '@/components/MsgComposer.vue'
import {
  parseReplyContentToMessages,
  messagesToReplyContent,
  replyContentSummary
} from '@/components/msgComposerHelpers'
import { isMobile } from '@/utils/deviceDetector'

export default {
  name: 'NewFriendAutoReply',
  components: { MsgComposer },
  data() {
    return {
      loading: false,
      saving: false,
      tableData: [],
      dialogVisible: false,
      currentWechatId: '',
      form: {
        messages: [],
        startTime: '00:00',
        endTime: '00:00',
        enabled: false
      }
    }
  },
  computed: {
    mobile() {
      return isMobile()
    }
  },
  created() {
    this.fetchList()
  },
  methods: {
    summarize(raw) {
      return replyContentSummary(raw)
    },
    fetchList() {
      this.loading = true
      listNewFriendReply()
        .then((res) => {
          if (res && res.code === 0) {
            this.tableData = res.data || []
          } else {
            this.$message.error((res && res.msg) || '加载失败')
          }
        })
        .catch(() => {
          this.$message.error('加载失败')
        })
        .finally(() => {
          this.loading = false
        })
    },
    openDialog(row) {
      this.currentWechatId = row.wechatId
      this.form = {
        messages: parseReplyContentToMessages(row.replyContent),
        startTime: row.startTime || '00:00',
        endTime: row.endTime || '00:00',
        enabled: row.enabled === 1
      }
      this.dialogVisible = true
    },
    saveForm() {
      if (this.form.enabled && (!this.form.messages || !this.form.messages.length)) {
        this.$message.warning('启用时请至少添加一条欢迎语')
        return
      }
      this.saving = true
      saveNewFriendReply({
        wechatId: this.currentWechatId,
        enabled: this.form.enabled ? 1 : 0,
        replyContent: messagesToReplyContent(this.form.messages),
        startTime: this.form.startTime || '00:00',
        endTime: this.form.endTime || '00:00'
      })
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('已保存')
            this.dialogVisible = false
            this.fetchList()
          } else {
            this.$message.error((res && res.msg) || '保存失败')
          }
        })
        .catch(() => {
          this.$message.error('保存失败')
        })
        .finally(() => {
          this.saving = false
        })
    },
    onToggleEnabled(row, val) {
      toggleNewFriendReply(row.wechatId, val ? 1 : 0)
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success(val ? '已启用' : '已停用')
            this.fetchList()
          } else {
            this.$message.error((res && res.msg) || '操作失败')
          }
        })
        .catch(() => {
          this.$message.error('操作失败')
        })
    },
    onToggleAutoAccept(row, val) {
      autoTaskUpdate(row.wechatId, 1002, val ? 0 : 1)
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success(val ? '已开启自动通过' : '已关闭自动通过')
            this.fetchList()
          } else {
            this.$message.error((res && res.msg) || '操作失败')
          }
        })
        .catch(() => {
          this.$message.error('操作失败')
        })
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
    margin-bottom: 12px;
    padding: 10px 12px;
    background: #fef0f0;
    border: 1px solid #fde2e2;
    color: #f56c6c;
    font-size: 13px;
    border-radius: 4px;
  }
  .el-table {
    flex: 1;
  }
  .wx-cell {
    .sub {
      color: #909399;
      font-size: 12px;
      word-break: break-all;
    }
  }
  .empty-tip {
    color: #909399;
    font-size: 13px;
    padding: 24px 12px;
    text-align: center;
  }
  .form-hint {
    color: #909399;
    font-size: 12px;
    margin-top: 4px;
  }

  .new-friend-reply-form {
    :deep(.new-friend-reply-form__composer .el-form-item__content) {
      flex: 1;
      min-width: 0;
    }
  }
}
</style>
