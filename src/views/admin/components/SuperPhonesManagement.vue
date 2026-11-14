<template>
  <div class="phone-management">
    <!-- 搜索|新增 -->
    <div class="set-parameters">
      <el-input
        v-model="deviceid"
        class="device-wechat-id"

        placeholder="请输入设备号"
        clearable
        minlength="15"
        maxlength="16"
        show-word-limit
      ></el-input>
      <el-input
        v-model="wechatid"
        class="wechat-id-input device-wechat-id"

        placeholder="请输入wxid"
        clearable
        minlength="6"
        maxlength="20"
        show-word-limit
      ></el-input>
      <el-select v-model="isonline"  placeholder="上线状态" filterable clearable>
        <el-option v-for="ols in onlineState" :key="ols.id" :label="ols.label" :value="ols.value"></el-option>
      </el-select>
      <el-button type="primary"  @click="queryData">查询</el-button>
    </div>

    <!-- 信息展示 -->
    <el-table :data="tableData" stripe style="width: 100%" height="60px">
      <el-table-column prop="deviceid" label="设备号" header-align="center" align="center"></el-table-column>
      <el-table-column prop="wxid" label="微信id" header-align="center" align="center"></el-table-column>
      <!-- <el-table-column prop="wechatno" label="微信号" header-align="center" align="center"></el-table-column> -->
      <el-table-column prop="name" label="微信昵称" header-align="center" align="center"></el-table-column>
      <el-table-column prop="devnickname" label="设备备注" header-align="center" align="center" min-width="100" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.devnickname || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="是否在线" header-align="center" align="center">
        <template #default="scope">
          <span v-if="scope.row.isonline === 1" style="color: #67c23a" v-text="'已上线'"></span>
          <span v-else style="color: #f56c6c" v-text="'已下线'"></span>
        </template>
      </el-table-column>
      <el-table-column prop="cname" label="所属客户" header-align="center" align="center">
        <template #default="scope">
          <span v-text="scope.row.cname ? scope.row.cname : '--'"></span>
        </template>
      </el-table-column>
      <el-table-column prop="accountname" label="登录账号" header-align="center" align="center"></el-table-column>
      <el-table-column label="登录时间" header-align="center" align="center">
        <template #default="scope">
          <span v-text="$filters.transformTime2Minute(scope.row.login_time)"></span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      :current-page="pageNo"
      :page-sizes="[20, 40, 60, 80]"
      :page-size="pageSize"
      :pager-count="5"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    ></el-pagination>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { queryDevicesAll } from '@/api/httpApiAdmin'

export default {
  name: 'PhonesManagerment',
  data() {
    return {
      tableData: [], // 表格中的数据
      deviceid: '', // 设备号
      wechatid: '', // 微信id
      isonline: '', // 微信在线状态：1在线 0离线
      onlineState: [
        {
          id: 'isonline1',
          value: 1,
          label: '已上线'
        },
        {
          id: 'isonline0',
          value: 0,
          label: '已下线'
        }
      ], // 微信在线状态列表
      pageNo: 1, // 第几页
      pageSize: 20, // 每页几个数据
      total: 0 // 总数
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    })
  },
  mounted() {
    this.queryDataSilence()
  },
  methods: {
    // 分页查询数据
    queryData() {
      queryDevicesAll(this.pageNo, this.pageSize, this.isonline, this.wechatid, this.deviceid).then((res) => {
        if (res.code === 0) {
          this.tableData = res.data.rows || []
          this.total = res.data.records || 0
          this.$message({
            type: 'success',
            message: '查询成功！',
            duration: 1000
          })
        }
      })
    },
    queryDataSilence() {
      queryDevicesAll(this.pageNo, this.pageSize, this.isonline, this.wechatid, this.deviceid).then((res) => {
        if (res.code === 0) {
          this.tableData = res.data.rows || []
          this.total = res.data.records || 0
        }
      })
    },
    // 修改pageSize
    handleSizeChange(val) {
      if (this.pageSize === val) return
      this.pageSize = val
      this.queryData()
    },
    // 修改当前页
    handleCurrentChange(val) {
      this.pageNo = val
      this.queryData()
    }
  }
}
</script>

<style lang="scss" scoped>
.phone-management {
  height: 100%;
  display: flex;
  flex-direction: column;

  .set-parameters {
    padding: 10px 5px;
    display: flex;
    align-items: center;
    border-bottom: solid $border-color-1 2px;
    .el-button,
    .wechat-id-input,
    .el-select {
      margin-left: 20px;
    }
    :deep(.device-wechat-id) {
      width: 260px;
      .el-input__inner {
        width: 260px;
      }
    }
  }

  .el-pagination {
    padding: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-top: solid 1px $border-color-1;
    background-color: white;
  }

  :deep(.el-dialog) {
    width: 500px;
    .el-form {
      width: 400px;
    }
  }
}
</style>
