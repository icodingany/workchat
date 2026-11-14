<template>
  <div class="task-config">
    <div class="config-item">
      <span class="label">任务备注</span>
      <el-input
        v-model="taskForm.remarks"
        placeholder="可选，便于列表识别"
        maxlength="150"
        show-word-limit
      />
    </div>

    <div class="config-item">
      <span class="label required">开始时间</span>
      <el-radio-group v-model="taskForm.startTimeType">
        <el-radio value="immediate">立即推送</el-radio>
        <el-radio value="scheduled">定时推送</el-radio>
      </el-radio-group>
      <el-date-picker
        v-if="taskForm.startTimeType === 'scheduled'"
        v-model="taskForm.scheduledTime"
        type="datetime"
        value-format="x"
        format="YYYY-MM-DD HH:mm:ss"
        placeholder="选择日期时间"
        style="width: 220px"
        :default-value="panelNow"
        :default-time="panelNow"
        @visible-change="onPickerVisible"
      />
    </div>

    <div class="config-item">
      <span class="label required">每个好友/群发送间隔时间</span>
      <div class="time-range">
        <el-input-number
          v-model="taskForm.friendInterval.min"
          :min="2"
          :max="taskForm.friendInterval.max"
          size="small"
        />
        <span class="separator">~</span>
        <el-input-number
          v-model="taskForm.friendInterval.max"
          :min="taskForm.friendInterval.min"
          :max="120"
          size="small"
        />
        <span class="unit">秒</span>
      </div>
    </div>
    <div class="native-tip">
      <i class="el-icon-info" /> 防风控提示：群发按拟真人节奏执行，建议好友间隔 10~20 秒、消息间隔 5~10 秒（对齐个微端默认）；同内容多发易触发企微风控撤回，建议为不同分组准备文案变体；设置过快时手机端会按安全节奏自动放宽。
    </div>

    <div class="config-item">
      <span class="label required">每条消息发送间隔时间</span>
      <div class="time-range">
        <el-input-number
          v-model="taskForm.messageInterval.min"
          :min="2"
          :max="taskForm.messageInterval.max"
          size="small"
        />
        <span class="separator">~</span>
        <el-input-number
          v-model="taskForm.messageInterval.max"
          :min="taskForm.messageInterval.min"
          :max="120"
          size="small"
        />
        <span class="unit">秒</span>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 群发任务配置：开始时间 + 好友/群间隔 + 消息间隔（对齐 kelailaichatpc，不含循环）
 */
export default {
  name: 'MassSendTaskConfig',
  props: {
    /** 含 remarks、startTimeType、scheduledTime、friendInterval、messageInterval */
    taskForm: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      /** 面板打开时用于 default-value / default-time，避免落到 00:00:00 */
      panelNow: new Date()
    }
  },
  watch: {
    'taskForm.startTimeType': {
      immediate: true,
      handler(type) {
        if (type === 'scheduled') {
          this.setScheduledToNow()
        }
      }
    }
  },
  methods: {
    setScheduledToNow() {
      this.panelNow = new Date()
      this.taskForm.scheduledTime = Date.now()
    },
    /** 弹出时间面板时，默认填入当前时间 */
    onPickerVisible(visible) {
      if (visible) {
        this.setScheduledToNow()
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.task-config {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 16px 20px;
  width: 100%;
  box-sizing: border-box;

  .native-tip {
    margin: -8px 0 16px;
    color: #909399;
    font-size: 12px;
    line-height: 1.6;
  }

  .config-item {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      flex-shrink: 0;
      color: #606266;
      min-width: 160px;

      &.required::before {
        content: '*';
        color: #f56c6c;
        margin-right: 4px;
      }
    }

    .time-range {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;

      .separator {
        color: #909399;
      }

      .unit {
        color: #606266;
      }
    }

    // 仅备注输入框：show-word-limit 需要右内边距；勿作用于 el-date-editor
    :deep(.el-input:not(.el-date-editor)) {
      flex: 1 1 220px;
      width: auto;
      max-width: 360px;
      min-width: 0;
    }

    :deep(.el-input:not(.el-date-editor) .el-input__wrapper) {
      padding-right: 72px;
    }

    :deep(.el-input:not(.el-date-editor) .el-input__count) {
      white-space: nowrap;
    }

    .el-date-picker,
    .el-date-editor {
      margin-left: 0;
    }
  }
}
</style>
