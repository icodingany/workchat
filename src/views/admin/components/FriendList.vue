<template>
  <div class="ww-admin-page">
    <div class="set-parameters">
      <el-input v-model="wxId" clearable placeholder="企微号 WxId" class="filter-item" />
      <el-select v-model="contactType" clearable placeholder="类型" class="filter-item">
        <el-option label="全部" value="" />
        <el-option label="内部同事" :value="1" />
        <el-option label="外部客户" :value="2" />
      </el-select>
      <el-input v-model="keyword" clearable placeholder="昵称/备注" class="filter-item" @keyup.enter="queryData" />
      <el-button type="primary" @click="queryData">查询</el-button>
    </div>

    <div v-if="mobile" v-loading="loading" class="mobile-admin-cards">
      <div v-if="!loading && !tableData.length" class="empty-tip">暂无数据，请先在客服端同步通讯录/客户后再查看</div>
      <article v-for="row in tableData" :key="`${row.wxId}-${row.remoteId}`" class="mobile-admin-card">
        <header class="mobile-admin-card__head">
          <strong class="mobile-admin-card__title">{{ row.name || '-' }}</strong>
          <el-button link type="primary" @click="openChat(row)">查看聊天</el-button>
        </header>
        <dl class="mobile-admin-card__rows">
          <div v-if="row.alias" class="mobile-admin-card__row">
            <dt>备注</dt>
            <dd>{{ row.alias }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>类型</dt>
            <dd>{{ row.contactType === 1 ? '内部同事' : row.contactType === 2 ? '外部客户' : '-' }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>企微号</dt>
            <dd>{{ row.wxId || '-' }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>更新时间</dt>
            <dd>{{ $filters.transformTime2Minute(row.updateTime) }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <el-table v-else v-loading="loading" :data="tableData" stripe border height="100%">
      <el-table-column label="头像" width="70" align="center">
        <template #default="scope">
          <el-avatar :size="36" shape="square" :src="scope.row.avatar" />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="alias" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="类型" width="100" align="center">
        <template #default="scope">
          {{ scope.row.contactType === 1 ? '内部同事' : scope.row.contactType === 2 ? '外部客户' : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="wxId" label="企微号" min-width="140" show-overflow-tooltip />
      <el-table-column prop="remoteId" label="RemoteId" min-width="140" show-overflow-tooltip />
      <el-table-column label="更新时间" width="160" align="center">
        <template #default="scope">
          <span v-text="$filters.transformTime2Minute(scope.row.updateTime)"></span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" align="center" fixed="right">
        <template #default="scope">
          <el-button link @click="openChat(scope.row)">查看聊天</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!mobile && !loading && total === 0" class="empty-tip">暂无数据，请先在客服端同步通讯录/客户后再查看</div>
    <el-pagination
      :current-page="pageNo"
      :page-sizes="[20, 40, 60]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
    <friend-chat-dialog v-model:visible="chatVisible" :friend="chatFriend" />
  </div>
</template>

<script>
import { pageWwContacts } from '@/api/httpApiAdmin'
import FriendChatDialog from './FriendChatDialog.vue'
import { isMobile } from '@/utils/deviceDetector'

export default {
  name: 'FriendList',
  components: { FriendChatDialog },
  data() {
    return {
      loading: false,
      wxId: '',
      contactType: '',
      keyword: '',
      tableData: [],
      pageNo: 1,
      pageSize: 20,
      total: 0,
      chatVisible: false,
      chatFriend: null
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
    openChat(row) {
      this.chatFriend = {
        wxId: row.wxId,
        remoteId: row.remoteId,
        name: row.name,
        alias: row.alias,
        avatar: row.avatar
      }
      this.chatVisible = true
    },
    queryData() {
      this.pageNo = 1
      this.fetchList()
    },
    fetchList() {
      this.loading = true
      pageWwContacts({
        wxId: this.wxId,
        contactType: this.contactType,
        keyword: this.keyword,
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
  .empty-tip {
    margin: 8px 0;
    color: #909399;
    font-size: 13px;
  }
  .el-pagination {
    margin-top: 12px;
    text-align: right;
  }
}
</style>
