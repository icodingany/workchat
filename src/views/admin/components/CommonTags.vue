<template>
  <div class="phone-management">
    <!-- 搜索|新增 -->
    <div class="set-parameters">
      <el-input
        v-model="tagName"
        class="device-wechat-id"

        placeholder="请输入标签名"
        clearable
        minlength="15"
        maxlength="16"
        show-word-limit
      ></el-input>
      <el-button type="primary"  @click="queryData">查询</el-button>
      <el-button type="primary"  @click="showDialog">添加</el-button>
    </div>

    <!-- 信息展示 -->
    <el-table :data="tableData" stripe style="width: 100%" height="60px">
      <el-table-column prop="name" label="标签名" header-align="center" align="center"></el-table-column>
      <el-table-column label="创建时间" header-align="center" align="center">
        <template #default="scope">
          <span v-text="$filters.transformTime2Minute(scope.row.create_time)"></span>
        </template>
      </el-table-column>
      <el-table-column label="操作" header-align="center" align="center">
        <template #default="scope">
          <el-button  @click="handleEdit(scope.$index, scope.row)">修改</el-button>
          <el-button  style="background-color: #ff9f00; color: #ffffff" type="warning" @click="handleDelete(scope.$index, scope.row)">删除</el-button>
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

    <el-dialog
      :modal="false"
      append-to-body
      :title="dialogTitle"
      v-model="dialogVisible"
    >
      <el-form ref="ruleForm" :model="form" :rules="rules">
        <el-form-item label="标签名" :label-width="formLabelWidth" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入标签名"
            clearable
            maxlength="20"
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
import {
  queryCommonTags,
  deleteCommonTags,
  addCommonTag,
  updateCommonTag
} from '@/api/httpApiAdmin'

export default {
  name: 'PhonesManagerment',
  data() {
    return {
      tableData: [], // 表格中的数据
      tagName: '', // 标签名

      pageNo: 1, // 第几页
      pageSize: 20, // 每页几个数据
      total: 0, // 总数
      dialogTitle: '添加标签',
      dialogVisible: false, // 显示dialog
      formLabelWidth: '120px',
      form: {
        id: '',
        cid: '',
        name: ''
      }, // 表单
      rules: {
        name: [{ required: true, message: '请输入标签名', trigger: 'blur' }]
      } // 表单验证
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    })
  },
  watch: {
    // accountName(val) {
    //   if (val.trim() === '') {
    //     this.queryData()
    //   }
    // }
  },
  mounted() {
    this.queryDataSilence()
  },
  methods: {
    // 分页查询数据
    queryData() {
      queryCommonTags(this.tagName, this.pageNo, this.pageSize).then((res) => {
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
      queryCommonTags(this.tagName, this.pageNo, this.pageSize).then((res) => {
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
      this.dialogTitle = '添加标签'
      this.dialogVisible = true
    },
    // 修改或添加设备
    updateOrAddDevice() {
      this.$refs['ruleForm'].validate((valid) => {
        if (valid) {
          const { id, name } = this.form
          if (this.dialogTitle === '添加标签') {
            addCommonTag(name).then((res) => {
              if (res.code === 0) {
                this.queryDataSilence()
                this.dialogVisible = false
                this.$message({
                  type: 'success',
                  message: '添加成功!',
                  duration: 1000
                })
              }
            })
          } else {
            updateCommonTag(id, name).then((res) => {
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
        id: '',
        cid: '',
        name: ''
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
      this.dialogTitle = '编辑标签'
      this.dialogVisible = true
    },
    // 删除
    handleDelete(index, row) {
      this.$confirm('是否删除设备？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          deleteCommonTags(row.id).then((res) => {
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
    max-width: 500px;

    .el-form {
      width: 100%;
      max-width: 400px;
    }
  }
}
</style>
