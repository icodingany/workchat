<template>
  <div class="group-send" v-if="$route.name === 'groupAssistant'">
    <el-tabs style="width: 100%; height: 100%" v-model="activeName">
      <el-tab-pane label="群发助手" name="send">
        <GroupAssistantSend v-if="activeName === 'send'" />
      </el-tab-pane>
      <el-tab-pane label="定时群发日志" name="log">
        <GroupAssistantLog v-if="activeName === 'log'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import GroupAssistantSend from './components/GroupAssistantSend.vue'
import GroupAssistantLog from './components/GroupAssistantLog.vue'

export default {
  data() {
    return {
      activeName: 'send'
    }
  },
  components: {
    GroupAssistantSend,
    GroupAssistantLog
  }
}
</script>

<style lang="scss" scoped>
.group-send {
  padding: 0 5px;
  //   box-sizing: content-box;

  display: flex;
  flex: 1 1 auto;
  overflow: hidden;

  :deep(.el-tabs) {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .el-tabs__content {
      flex: 1 1 auto;
      overflow: hidden;

      .el-tab-pane {
        height: 100%;
        overflow: hidden;
      }
    }
  }
}
</style>
