<template>
  <div class="friend-circle" v-if="$route.name === 'friendCircle'">
    <el-tabs style="width: 100%; height: 100%" v-model="activeName">
      <el-tab-pane label="发朋友圈" name="circleSend">
        <FriendCircleSend v-if="activeName === 'circleSend'" />
      </el-tab-pane>
      <el-tab-pane label="我的朋友圈" name="circleMy">
        <FriendCircleMy v-if="activeName === 'circleMy'" />
      </el-tab-pane>
      <el-tab-pane label="定时任务日志" name="circleLog">
        <FriendCircleLog v-if="activeName === 'circleLog'" />
      </el-tab-pane>
    </el-tabs>
    <!-- <component :is="$store.getters['currentNavs'][$route.name]"></component> -->
  </div>
</template>

<script>
import FriendCircleSend from './components/FriendCircleSend.vue'
import FriendCircleMy from './components/FriendCircleMy.vue'
import FriendCircleLog from './components/FriendCircleLog.vue'

// const circleLog = () => import(/* webpackChunkName: "friendCircle" */ './components/FriendCircleLog.vue')

export default {
  data() {
    return {
      activeName: 'circleSend'
    }
  },
  components: {
    FriendCircleSend,
    FriendCircleMy,
    FriendCircleLog
  }
}
</script>

<style lang="scss" scoped>
.friend-circle {
  padding: 0 5px;
  box-sizing: content-box;

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
