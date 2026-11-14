<template>
  <div class="tools" v-if="$route.name === 'addFriend'">
    <el-tabs v-model="activeName">
      <el-tab-pane label="搜索手机号码添加" name="AddFriend">
        <AddFriend v-if="activeName === 'AddFriend'" />
      </el-tab-pane>
      <el-tab-pane label="从微信好友中添加" name="AddFriendFromWx">
        <AddFriendFromWx v-if="activeName === 'AddFriendFromWx'" />
      </el-tab-pane>
      <el-tab-pane label="批量加好友" name="AddFriends">
        <AddFriends v-if="activeName === 'AddFriends'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import AddFriend from './components/AddFriend.vue'
import AddFriends from './components/AddFriends.vue'
import AddFriendFromWx from './components/AddFriendFromWx.vue'

export default {
  data() {
    return {
      activeName: 'AddFriend'
    }
  },
  components: {
    AddFriend,
    AddFriends,
    AddFriendFromWx
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
