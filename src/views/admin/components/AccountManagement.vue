<template>
  <div class="search-phones">
    <!-- 搜索|新增 -->
    <div class="set-parameters">
      <el-input
        v-model="accountName"

        placeholder="请输入账号名称"
        clearable
        maxlength="20"
        show-word-limit
        style="width: 220px"
      ></el-input>
      <el-button type="primary"  @click="queryData">查询</el-button>
      <el-button v-if="!identityManaged" type="primary"  @click="showDialog">添加</el-button>
      <span v-if="identityManaged" class="managed-hint">账号由客徕徕系统统一管理，开通/修改请前往客徕徕</span>
    </div>

    <!-- 信息展示：账号/昵称/角色/状态（对齐账号管理，去掉密码与创建时间） -->
    <el-table :data="tableData" stripe style="width: 100%" height="60px">
      <el-table-column prop="account" label="账号" header-align="center" align="center"></el-table-column>
      <el-table-column prop="nickname" label="昵称" header-align="center" align="center"></el-table-column>
      <el-table-column label="角色" header-align="center" align="center">
        <template #default="scope">
          <span v-text="formatRole(scope.row.type)"></span>
        </template>
      </el-table-column>
      <el-table-column label="状态" header-align="center" align="center">
        <template #default="scope">
          <span v-text="scope.row.state === 1 ? '正常' : '禁用'"></span>
        </template>
      </el-table-column>
      <el-table-column v-if="!identityManaged" label="操作" header-align="center" align="center">
        <template #default="scope">
          <el-button  @click="handleEdit(scope.$index, scope.row)">修改</el-button>
          <el-button
            v-if="!isCompanyAdmin(scope.row)"
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

    <el-dialog :modal="false" :title="dialogTitle" v-model="dialogVisible">
      <el-form ref="ruleForm" :model="form" :rules="rules">
        <el-form-item label="账号" :label-width="formLabelWidth" prop="account">
          <el-input
            v-model="form.account"
            placeholder="请输入账号名称"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="密码" :label-width="formLabelWidth" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            clearable
            show-password
            maxlength="20"
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item
          v-if="dialogTitle === '添加账号'"
          label="角色"
          :label-width="formLabelWidth"
          prop="type"
        >
          <el-radio-group v-model="form.type">
            <el-radio :value="1">普通管理员</el-radio>
            <el-radio :value="2">普通员工</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="昵称" :label-width="formLabelWidth" prop="nickname">
          <el-input
            v-model="form.nickname"
            placeholder="请输入昵称"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="状态" :label-width="formLabelWidth" required prop="state">
          <el-switch v-model="form.state" active-color="#13ce66" inactive-color="#ff4949"></el-switch>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateOrAddAccount">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { queryAccounts, addAccount, deleteAccounts, updateAccount, queryIdentityConfig } from '@/api/httpApiAdmin'

export default {
  name: 'AccountManagement',
  data() {
    const validateName = (rule, value, callback) => {
      const reg = /^[\S\u4e00-\u9fa5a-z0-9_-]{1,16}$/
      if (reg.test(value)) {
        callback()
      } else {
        callback(new Error('账号必须由1-16个汉字、英文、数字、下划线、中划线组成'))
      }
    }
    const validatePass = (rule, value, callback) => {
      const reg = /^[0-9a-z]{6,16}$/gi
      if (reg.test(value)) {
        callback()
      } else {
        callback(new Error('密码长度6-16位，必须是数字或字母'))
      }
    }
    return {
      tableData: [], // 表格中的数据
      accountName: '', // 账号名称
      pageNo: 1, // 第几页
      pageSize: 20, // 每页几个数据
      total: 0, // 总数
      identityManaged: false, // 账号由客徕徕系统托管时隐藏增删改入口
      dialogTitle: '添加账号',
      dialogVisible: false, // 显示dialog
      currentAccount: {}, // 要编辑的部门
      formLabelWidth: '120px',
      form: {
        account: '', // 账号名称
        password: '', //  密码
        nickname: '', // 昵称
        state: true, // 账号状态1正常2禁用
        type: 2, // 1普通管理员 2普通员工（添加时可选）
        level: 1
      }, // 表单
      rules: {
        account: [
          { required: true, message: '请输入用户名', trigger: 'blur' },
          { validator: validateName, trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' },
          { validator: validatePass, trigger: 'blur' }
        ],
        type: [{ required: true, message: '请选择角色', trigger: 'change' }],
        nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }]
      } // 表单验证
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    })
  },
  watch: {
    accountName(val) {
      if (val.trim() === '') {
        this.queryData()
      }
    }
  },
  mounted() {
    this.loadIdentityConfig()
    this.queryDataSilence()
  },
  methods: {
    /** 账号是否由客徕徕系统托管（托管时只读展示） */
    loadIdentityConfig() {
      queryIdentityConfig().then((res) => {
        if (res.code === 0 && res.data && res.data.managedExternally) {
          this.identityManaged = true
        }
      }).catch(() => {})
    },
    /** type=0 公司管理员，type=1 普通管理员，type=2 普通员工 */
    formatRole(type) {
      const t = Number(type)
      if (t === 0) return '公司管理员'
      if (t === 1) return '普通管理员'
      if (t === 2) return '普通员工'
      return '普通员工'
    },
    /** 公司管理员不允许删除 */
    isCompanyAdmin(row) {
      return row && Number(row.type) === 0
    },
    // 分页查询数据
    queryData() {
      queryAccounts(this.accountName, this.pageNo, this.pageSize).then((res) => {
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
      queryAccounts(this.accountName, this.pageNo, this.pageSize).then((res) => {
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
      this.dialogTitle = '添加账号'
      this.dialogVisible = true
    },
    // 修改或新建部门
    updateOrAddAccount() {
      this.$refs['ruleForm'].validate((valid) => {
        if (valid) {
          const { id, account, password, nickname, state, level, type } = this.form
          if (this.dialogTitle === '添加账号') {
            addAccount(account, password, nickname, state ? 1 : 2, level, type).then((res) => {
              if (res.code === 0) {
                this.queryDataSilence()
                this.dialogVisible = false
                this.$message({
                  type: 'success',
                  message: '添加账号成功!',
                  duration: 1000
                })
              }
            })
          } else {
            updateAccount(id, account, password, nickname, state ? 1 : 2, level).then((res) => {
              if (res.code === 0) {
                this.dialogVisible = false
                this.queryDataSilence()
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
        account: '',
        password: '',
        nickname: '',
        state: true,
        type: 2,
        level: 1
      }
    },
    // 显示编辑dialog
    handleEdit(index, row) {
      for (const key in row) {
        if (row.hasOwnProperty(key)) {
          if (key === 'state') {
            this.form[key] = row[key] === 1
          } else {
            this.form[key] = row[key]
          }
        }
      }
      this.currentAccount = row
      this.dialogTitle = '编辑账号'
      this.dialogVisible = true
    },
    // 删除
    handleDelete(index, row) {
      if (this.isCompanyAdmin(row)) {
        this.$message({ type: 'warning', message: '公司管理员不支持删除', duration: 2000 })
        return
      }
      const confirmMsg = `确定要删除账号 "${row.account}" 吗？
删除后将同时清除该账号的以下关联数据：
• 微信设备关联关系
• 角色关联关系
• 部门关联关系

此操作不可恢复！`

      this.$confirm(confirmMsg, '删除账号确认', {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true,
        customClass: 'delete-account-confirm'
      })
        .then(() => {
          deleteAccounts(row.id).then((res) => {
            if (res.code === 0) {
              const pn = Math.ceil((this.total - 1) / this.pageSize)
              if (this.pageNo > pn) {
                this.pageNo = pn
              }
              this.queryDataSilence()
              this.$message({
                type: 'success',
                message: '删除成功！账号及其关联数据已清除',
                duration: 2000
              })
            } else {
              this.$message({
                type: 'error',
                message: res.msg || '删除失败，请重试',
                duration: 2000
              })
            }
          }).catch(() => {
            this.$message({
              type: 'error',
              message: '删除失败，网络错误',
              duration: 2000
            })
          })
        })
        .catch(() => {
          this.$message({
            type: 'info',
            message: '已取消删除',
            duration: 1000
          })
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.search-phones {
  height: 100%;
  display: flex;
  flex-direction: column;

  .set-parameters {
    padding: 10px 5px;
    display: flex;
    align-items: center;
    border-bottom: solid $border-color-1 2px;
    .el-button {
      margin-left: 20px;
    }
    .managed-hint {
      margin-left: 16px;
      font-size: 12px;
      color: #909399;
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

// 删除确认对话框样式
:deep(.delete-account-confirm) {
  .el-message-box__message {
    p {
      line-height: 1.8;
      margin: 0;
      font-size: 14px;
      color: #606266;
    }

    .el-message-box__content {
      padding: 20px;
    }
  }
}
</style>
