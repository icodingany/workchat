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
      <el-select v-model="accountid"  placeholder="请选择客服账号" filterable clearable>
        <el-option
          v-for="account in accounts"
          :key="account.id"
          :label="formatAccountLabel(account)"
          :value="account.id"
        ></el-option>
      </el-select>
      <el-select v-model="isonline"  placeholder="上线状态" filterable clearable>
        <el-option v-for="ols in onlineState" :key="ols.id" :label="ols.label" :value="ols.value"></el-option>
      </el-select>
      <el-button type="primary"  @click="queryData">查询</el-button>
      <el-button type="primary"  @click="showDialog">添加</el-button>
    </div>

    <!-- 信息展示 -->
    <el-table :data="tableData" stripe style="width: 100%" height="60px">
      <el-table-column prop="accountname" label="所属操作员" header-align="center" align="center" min-width="140"></el-table-column>
      <el-table-column prop="deviceid" label="设备号" header-align="center" align="center"></el-table-column>
      <el-table-column prop="wxid" label="微信id" header-align="center" align="center"></el-table-column>
      <el-table-column prop="name" label="微信昵称" header-align="center" align="center"></el-table-column>
      <el-table-column prop="devnickname" label="设备备注" header-align="center" align="center" min-width="100" show-overflow-tooltip>
        <template #default="scope">
          <span>{{ scope.row.devnickname || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="手机是否在线" header-align="center" align="center">
        <template #default="scope">
          <span v-if="scope.row.isonline === 1" style="color: #67c23a" v-text="'已上线'"></span>
          <span v-else style="color: #f56c6c" v-text="'已下线'"></span>
        </template>
      </el-table-column>
      <el-table-column label="最近登陆时间" header-align="center" align="center">
        <template #default="scope">
          <span v-text="$filters.transformTime2Minute(scope.row.login_time)"></span>
        </template>
      </el-table-column>
      <el-table-column label="操作" header-align="center" align="center">
        <template #default="scope">
          <el-button  @click="handleEdit(scope.$index, scope.row)">修改</el-button>
          <el-button

            style="background-color: #ff9f00; color: #ffffff"
            type="warning"
            @click="handleDelete(scope.$index, scope.row)"
          >
            删除
          </el-button>
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

    <el-dialog append-to-body :modal="false" :title="dialogTitle" v-model="dialogVisible">
      <el-form ref="ruleForm" :model="form" :rules="rules">
        <el-form-item label="所属操作员" :label-width="formLabelWidth" prop="accountids">
          <el-select
            v-model="form.accountids"
            placeholder="请选择操作员（可多选）"
            filterable
            multiple
            collapse-tags
            clearable
            popper-append-to-body
            style="width: 320px"
          >
            <el-option
              v-for="account in accounts"
              :key="account.id"
              :label="formatAccountLabel(account)"
              :value="account.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="设备ID" :label-width="formLabelWidth" prop="deviceid">
          <el-input
            v-model="form.deviceid"
            placeholder="请输入设备号"
            clearable
            minlength="15"
            maxlength="16"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="设备备注" :label-width="formLabelWidth" prop="devnickname">
          <el-input
            v-model="form.devnickname"
            placeholder="请输入设备备注"
            clearable
            maxlength="50"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateOrAddDevice">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { queryAccountsByCid, queryDevices, deleteDevices, addDevice, updateDevice } from '@/api/httpApiAdmin'

export default {
  name: 'PhonesManagerment',
  data() {
    return {
      tableData: [], // 表格中的数据
      deviceid: '', // 设备号
      wechatid: '', // 微信id
      accountid: '', // 客服账号id
      accounts: [], // 客服列表
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
      total: 0, // 总数
      dialogTitle: '添加设备',
      dialogVisible: false, // 显示dialog
      formLabelWidth: '120px',
      form: {
        id: '',
        cid: '',
        deviceid: '', // 设备id（一般为imei）
        accountids: [], // 所属操作员账号 id 列表
        devnickname: '' // 设备备注
        // 品牌/型号由手机端登录同步，不在此表单填写
      }, // 表单
      rules: {
        accountids: [{ required: true, type: 'array', min: 1, message: '请至少选择一个操作员', trigger: 'change' }],
        deviceid: [{ required: true, message: '请输入设备号', trigger: 'blur' }]
      } // 表单验证
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    })
  },
  mounted() {
    this.loadAccounts()
    this.queryDataSilence()
  },
  methods: {
    /** 加载可分配操作员列表（编辑/添加设备下拉数据源） */
    loadAccounts() {
      return queryAccountsByCid().then((res) => {
        if (res.code === 0) {
          this.accounts = res.data || []
        } else {
          this.accounts = []
          this.$message.error(res.msg || '加载操作员列表失败')
        }
        return this.accounts
      })
    },
    /** 下拉展示：账号(昵称)，无昵称时仅账号 */
    formatAccountLabel(account) {
      if (!account) return ''
      return account.nickname ? `${account.account}(${account.nickname})` : account.account
    },
    /** 设备备注变更后刷新客服端微信列表（HTTP 首屏 + WS 在线态） */
    refreshClientWechats() {
      this.$store.dispatch('conversation/FetchWechatsList', { force: true })
      if (this.$store.state.webSocketToken) {
        this.$store.dispatch('websocket/GetWeChatsReq')
      }
    },
    // 分页查询数据
    queryData() {
      queryDevices(
        this.pageNo,
        this.pageSize,
        this.deviceid,
        this.wechatid,
        this.accountid,
        this.isonline
      ).then((res) => {
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
      queryDevices(
        this.pageNo,
        this.pageSize,
        this.deviceid,
        this.wechatid,
        this.accountid,
        this.isonline
      ).then((res) => {
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
    },
    // 显示dialog
    showDialog() {
      this.resetForm()
      this.dialogTitle = '添加设备'
      if (!this.accounts.length) {
        this.loadAccounts()
      }
      this.dialogVisible = true
    },
    // 修改或添加设备
    updateOrAddDevice() {
      this.$refs['ruleForm'].validate((valid) => {
        if (valid) {
          const { id, deviceid, accountids, devnickname } = this.form
          if (this.dialogTitle === '添加设备') {
            addDevice(deviceid, accountids, devnickname).then((res) => {
              if (res.code === 0) {
                this.queryDataSilence()
                this.refreshClientWechats()
                this.dialogVisible = false
                this.$message({
                  type: 'success',
                  message: '添加成功!',
                  duration: 1000
                })
              }
            })
          } else {
            updateDevice(id, deviceid, accountids, devnickname).then((res) => {
              if (res.code === 0) {
                this.dialogVisible = false
                this.queryDataSilence()
                this.refreshClientWechats()
                this.$message({
                  type: 'success',
                  message: '更新成功',
                  duration: 1000
                })
              }
            })
          }
        } else {
          return false
        }
      })
    },
    // 重置表单
    resetForm() {
      this.form = {
        id: '',
        cid: '',
        deviceid: '', // 设备id（一般为imei）
        accountids: [], // 所属操作员账号 id 列表
        devnickname: ''
      }
    },
    // 显示编辑dialog
    handleEdit(index, row) {
      this.resetForm()
      for (const key in row) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
          // 品牌/型号由手机端同步，编辑表单不带入也不提交
          if (key === 'brand' || key === 'module') {
            continue
          }
          if (key === 'state') {
            this.form[key] = row[key] === 1
          } else if (key !== 'accountids' && key !== 'accountid') {
            this.form[key] = row[key]
          }
        }
      }
      if (row.accountids) {
        this.form.accountids = String(row.accountids)
          .split(',')
          .filter(Boolean)
          .map((id) => Number(id))
      } else if (row.accountid != null && row.accountid !== '') {
        this.form.accountids = [Number(row.accountid)]
      }
      this.dialogTitle = '编辑设备'
      const open = () => {
        this.dialogVisible = true
      }
      if (!this.accounts.length) {
        this.loadAccounts().then(open).catch(open)
      } else {
        open()
      }
    },
    // 删除
    handleDelete(index, row) {
      this.$confirm('是否删除设备？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          deleteDevices(row.id).then((res) => {
            if (res.code === 0) {
              const pn = Math.ceil((this.total[this.activeName] - 1) / this.pageSize)
              if (this.pageNo > pn) {
                this.pageNo = pn
              }
              this.queryDataSilence()
              this.$message({
                type: 'success',
                message: '删除成功!',
                duration: 1000
              })
            }
          })
        })
        .catch(() => {
          this.$message({
            type: 'info',
            message: '取消',
            duration: 1000
          })
        })
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
      width: 220px;
      .el-input__inner {
        width: 220px;
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
