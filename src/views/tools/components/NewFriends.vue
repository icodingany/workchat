<template>
  <div class="new-friends">
    <el-table :data="tableData" stripe border style="width: 100%">
      <el-table-column label="名称" prop="Name"></el-table-column>
      <el-table-column label="别称" prop="Alias"></el-table-column>
      <el-table-column label="性别" prop="Gender"></el-table-column>
      <el-table-column label="来源" prop="Source">
        <template #default="{ row }">
          <span v-text="$filters.getFriendSource(row.Source)"></span>
          <!-- <span>{{ row.Source | getFriendSource }}</span> -->
        </template>
      </el-table-column>
      <!-- <el-table-column label="CorpId" prop="CorpId"></el-table-column>
      <el-table-column label="RemoteId" prop="RemoteId"></el-table-column>
      <el-table-column label="UnionId" prop="UnionId"></el-table-column> -->
      <el-table-column label="后缀" prop="Suffix"></el-table-column>
      <el-table-column label="操作" header-align="center" align="center">
        <template #default="scope">
          <el-button  @click="acceptFriend(scope.row)">添加</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { triggerNewCustomerTask, acceptCustomerTask } from '@/api/webSocketApi'

export default {
  name: 'NewFriends',
  data() {
    return {}
  },
  computed: {
    ...mapGetters({
      userId: 'userId',
      currentWeChatId: 'conversation/currentWeChatId'
    }),
    tableData() {
      return this.$store.getters['tools/newFriends']
    }
  },
  watch: {
    currentWeChatId(newId) {
      this.$store.commit('tools/RESET_NEW_FRIENDS')
      if (newId) {
        triggerNewCustomerTask(newId)
      }
    }
  },
  created() {
    if (this.currentWeChatId) {
      triggerNewCustomerTask(this.currentWeChatId)
    }
  },
  methods: {
    // 接受好友请求
    acceptFriend(row) {
      acceptCustomerTask(this.currentWeChatId, row.RemoteId)
    }
  }
}
</script>

<style lang="scss" scoped>
.new-friends {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
