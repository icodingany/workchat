<template>
  <div class="tools" v-if="$route.name === 'tools'">
    <el-tabs v-model="activeName">
      <el-tab-pane label="新的客户" name="NewFriends">
        <NewFriends v-if="activeName === 'NewFriends'" />
      </el-tab-pane>
      <el-tab-pane label="聊天记录" name="ChatHistory">
        <ChatHistory v-if="activeName === 'ChatHistory'" />
      </el-tab-pane>
      <el-tab-pane label="自动回复" name="AutoReply">
        <AutoReply v-if="activeName === 'AutoReply'" />
      </el-tab-pane>
      <el-tab-pane label="标签管理" name="LabelsManagement">
        <LabelsManagement v-if="activeName === 'LabelsManagement'" />
      </el-tab-pane>
      <el-tab-pane label="批量打标签" name="TakeLabels">
        <TakeLabels v-if="activeName === 'TakeLabels'" />
      </el-tab-pane>
      <el-tab-pane label="清理僵尸粉" name="ClearFans">
        <ClearFans v-if="activeName === 'ClearFans'" />
      </el-tab-pane>
      <el-tab-pane label="导出二维码" name="QrCode">
        <QrCode v-if="activeName === 'QrCode'" />
      </el-tab-pane>
      <el-tab-pane label="自动功能" name="AutoTask">
        <AutoTask v-if="activeName === 'AutoTask'" />
      </el-tab-pane>
      <el-tab-pane label="手机管理" name="PhoneManagement">
        <PhoneManagement v-if="activeName === 'PhoneManagement'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import NewFriends from './components/NewFriends.vue'
import ChatHistory from './components/ChatHistory.vue'
import AutoReply from './components/AutoReply.vue'
import QrCode from './components/QrCode.vue'
import LabelsManagement from './components/LabelsManagement.vue'
import AutoTask from './components/AutoTask.vue'
import PhoneManagement from './components/PhoneManagement.vue'
import TakeLabels from './components/TakeLabels.vue'
import ClearFans from './components/ClearFans.vue'

export default {
  data() {
    return {
      activeName: 'NewFriends'
    }
  },
  components: {
    NewFriends,
    ChatHistory,
    AutoReply,
    QrCode,
    LabelsManagement,
    AutoTask,
    PhoneManagement,
    TakeLabels,
    ClearFans
  }
}
</script>

<style lang="scss" scoped>
.tools {
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding: 0 5px 5px 5px;

  :deep(.el-tabs) {
    height: 100%;
    display: flex;
    flex-direction: column;

    .el-tabs__content {
      flex: 1 1 auto;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      //   height: 100%;

      .el-tab-pane {
        // height: 100%;
        flex: 1 1 auto;
        overflow: hidden;
      }
    }
  }
}
</style>
