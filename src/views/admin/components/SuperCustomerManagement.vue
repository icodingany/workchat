<template>
  <div class="customer-management">
    <!-- 搜索|新增 -->
    <div class="set-parameters">
      <el-input
        v-model="adminName"

        placeholder="请输入管理员名称"
        clearable
        maxlength="20"
        show-word-limit
        style="width: 220px"
      ></el-input>
      <el-input
        v-model="customerName"
        class="customer-name"

        placeholder="请输入客户名称"
        clearable
        maxlength="20"
        show-word-limit
        style="width: 220px"
      ></el-input>
      <el-button type="primary"  @click="queryData">查询</el-button>
      <el-button v-if="!identityManaged" type="primary"  @click="showDialog">添加</el-button>
      <span v-if="identityManaged" class="managed-hint">客户（公司）由客徕徕系统统一管理，如需开通请前往客徕徕</span>
    </div>

    <!-- 信息展示 -->
    <el-table :data="tableData" stripe style="width: 100%">
      <el-table-column prop="kid" label="公司标识" header-align="center" align="center" min-width="160" show-overflow-tooltip></el-table-column>
      <el-table-column prop="suppliername" label="客户名称" header-align="center" align="center"></el-table-column>
      <el-table-column prop="admin" label="管理员账号" header-align="center" align="center"></el-table-column>
      <el-table-column prop="dname" label="状态" header-align="center" align="center">
        <template #default="scope">
          <span v-if="scope.row.state === 1" style="color: #67c23a">正常</span>
          <span v-else style="color: #e6a23c">禁用</span>
        </template>
      </el-table-column>
      <el-table-column prop="account_num" label="最大账号数量" header-align="center" align="center"></el-table-column>
      <el-table-column prop="device_num" label="最大设备数量" header-align="center" align="center"></el-table-column>
      <el-table-column prop="contact" label="联系人" header-align="center" align="center"></el-table-column>
      <!-- <el-table-column prop="phone" label="联系人电话" header-align="center" align="center"></el-table-column> -->
      <el-table-column prop="validity" label="服务期限" header-align="center" align="center"></el-table-column>
      <!-- <el-table-column prop="description" label="备注信息" header-align="center" align="center"></el-table-column> -->
      <el-table-column label="创建时间" header-align="center" align="center">
        <template #default="scope">
          <span v-text="$filters.transformTime2Minute(scope.row.create_time)"></span>
        </template>
      </el-table-column>
      <el-table-column v-if="!identityManaged" label="操作" header-align="center" align="center">
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

    <el-dialog append-to-body :title="dialogTitle" v-model="dialogVisible">
      <el-form ref="ruleForm" :model="form" :rules="rules">
        <el-form-item label="客户名称" :label-width="formLabelWidth" prop="suppliername">
          <el-input
            v-model="form.suppliername"
            placeholder="请输入账号名称"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
            style="width: 280px"
          ></el-input>
        </el-form-item>
        <el-form-item label="最大账号数量" :label-width="formLabelWidth" prop="account_num">
          <el-input-number
            v-model="form.account_num"
            :min="1"
            :max="10000"
            label="请设置最大账号数量"
            style="width: 280px"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="最大设备数量" :label-width="formLabelWidth" prop="device_num">
          <el-input-number
            v-model="form.device_num"
            :min="1"
            :max="10000"
            label="请设置最大账号数量"
            style="width: 280px"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="服务期限" :label-width="formLabelWidth" prop="validity">
          <el-date-picker
            v-model="form.validity"
            style="width: 280px"
            type="date"
            placeholder="选择服务期限"
            :disabled-date="disabledDate"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="客户状态" :label-width="formLabelWidth" prop="state">
          <el-select v-model="form.state" placeholder="请选择阅读状态" filterable clearable style="width: 280px">
            <el-option v-for="cs in customerStates" :key="cs.id" :label="cs.label" :value="cs.value"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="管理员账号" :label-width="formLabelWidth" prop="admin">
          <el-input
            v-model="form.admin"
            placeholder="请输入管理员账号"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="联系人姓名" :label-width="formLabelWidth">
          <el-input
            v-model="form.contact"
            placeholder="请输入昵称"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="联系人电话" :label-width="formLabelWidth">
          <el-input
            v-model="form.phone"
            placeholder="请输入昵称"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="备注信息" :label-width="formLabelWidth">
          <el-input
            v-model="form.description"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 3 }"
            placeholder="请输入备注信息"
          ></el-input>
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
import { queryCustomers, addCustomer, deleteCustomers, updateCustomer, queryIdentityConfig } from '@/api/httpApiAdmin'

/**
 * 生成添加客户表单的默认值
 * <p>
 * 默认值约定（参照需求）：
 * <li>最大账号数量 account_num：100
 * <li>最大设备数量 device_num：100
 * <li>服务期限 validity：下一年今日（Date 对象，el-date-picker 绑定）
 * <li>客户状态 state：1=正常
 *
 * @returns {Object} 表单默认值对象
 */
function createDefaultForm() {
  const validity = new Date()
  validity.setFullYear(validity.getFullYear() + 1)
  return {
    kid: '', // 对外公司标识
    suppliername: '', // 客户名称
    account_num: 100, // 最大账号数量
    device_num: 100, // 最大设备数量
    validity: validity, // 服务期限
    state: 1, // 客户状态：1=正常 2=禁用
    admin: '', // 管理员账号
    contact: '', // 联系人姓名
    phone: '', // 联系人电话
    description: '' // 备注信息
  }
}

export default {
  name: 'CustomerManagement',
  data() {
    const validateName = (rule, value, callback) => {
      const reg = /^[\S\u4e00-\u9fa5a-z0-9_-]{1,16}$/
      if (reg.test(value)) {
        callback()
      } else {
        callback(new Error('账号必须由1-16个汉字、英文、数字、下划线、中划线组成'))
      }
    }
    return {
      tableData: [], // 表格中的数据
      adminName: '', // 管理员名称
      customerName: '', // 客户名称
      identityManaged: false, // 客户（公司）由客徕徕系统托管时隐藏增删改入口
      customerStates: [
        {
          id: 'customerStates0',
          value: 1,
          label: '正常'
        },
        {
          id: 'customerStates1',
          value: 2,
          label: '禁用'
        }
      ], // 阅读状态列表
      pageNo: 1, // 第几页
      pageSize: 20, // 每页几个数据
      total: 0, // 总数

      dialogTitle: '添加客户',
      dialogVisible: false, // 显示dialog

      formLabelWidth: '120px',
      form: createDefaultForm(), // 表单
      rules: {
        suppliername: [
          { required: true, message: '请输入用户名', trigger: 'blur' },
          { validator: validateName, trigger: 'blur' }
        ],
        account_num: [{ required: true, message: '请设置最大账号数量', trigger: 'blur' }],
        device_num: [{ required: true, message: '请设置最大账号数量', trigger: 'blur' }],
        validity: [{ required: true, message: '选择服务期限', trigger: 'blur' }],
        state: [{ required: true, message: '请选择阅读状态', trigger: 'blur' }],
        admin: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }]
      } // 表单验证
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    })
  },
  mounted() {
    this.loadIdentityConfig()
    this.queryDataSilence()
  },
  methods: {
    /** 客户（公司）是否由客徕徕系统托管（托管时只读展示） */
    loadIdentityConfig() {
      queryIdentityConfig().then((res) => {
        if (res.code === 0 && res.data && res.data.managedExternally) {
          this.identityManaged = true
        }
      }).catch(() => {})
    },
    // el-date-picker 的 disabled-date（element-plus 拆成独立 prop）
    disabledDate(time) {
      return time.getTime() < Date.now()
    },
    // 分页查询数据
    queryData() {
      queryCustomers(this.customerName, this.adminName, this.pageNo, this.pageSize).then((res) => {
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
      queryCustomers(this.customerName, this.adminName, this.pageNo, this.pageSize).then((res) => {
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
      this.dialogTitle = '添加客户'
      this.dialogVisible = true
    },
    // 修改或新建部门
    updateOrAddAccount() {
      this.$refs['ruleForm'].validate((valid) => {
        if (valid) {
          const { kid, suppliername, account_num, device_num, state, admin, contact, phone, description } = this.form
          const validity = this.form.validity
          if (this.dialogTitle === '添加客户') {
            const year = validity.getFullYear()
            let month = validity.getMonth() + 1
            if (month < 10) {
              month = '0' + month
            }
            const day = validity.getDate() < 10 ? '0' + validity.getDate() : validity.getDate()
            const validityTime = year + '-' + month + '-' + day
            addCustomer(
              suppliername,
              account_num,
              device_num,
              validityTime,
              state,
              admin,
              contact,
              phone,
              description
            ).then((res) => {
              if (res.code === 0) {
                this.queryDataSilence()
                this.dialogVisible = false
                this.$message({
                  type: 'success',
                  message: '添加客户成功!',
                  duration: 1000
                })
              }
            })
          } else {
            updateCustomer(
              kid,
              suppliername,
              account_num,
              device_num,
              validity,
              state,
              admin,
              contact,
              phone,
              description
            ).then((res) => {
              if (res.code === 0) {
                this.queryDataSilence()
                this.dialogVisible = false
                this.$message({
                  type: 'success',
                  message: '更新成功!',
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
    // 重置表单（复用默认值：账号/设备数量 100，服务期限下一年，状态正常）
    resetForm() {
      this.form = createDefaultForm()
    },
    // 显示编辑dialog
    handleEdit(index, row) {
      for (const key in row) {
        if (row.hasOwnProperty(key)) {
          this.form[key] = row[key]
        }
      }
      this.dialogTitle = '编辑客户'
      this.dialogVisible = true
    },
    // 删除
    handleDelete(index, row) {
      this.$confirm('是否删除客服账号！', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          deleteCustomers(row.kid).then((res) => {
            if (res.code === 0) {
              const pn = Math.ceil((this.total - 1) / this.pageSize)
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
.customer-management {
  height: 100%;
  display: flex;
  flex-direction: column;

  .set-parameters {
    padding: 10px 5px;
    display: flex;
    align-items: center;
    border-bottom: solid $border-color-1 2px;
    .customer-name,
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
</style>
