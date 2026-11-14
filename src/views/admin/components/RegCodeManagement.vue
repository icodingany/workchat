<template>
  <div class="regcode-management">
    <div class="set-parameters">
      <el-input
        v-model="searchCode"
        class="search-input"
        placeholder="激活码或设备IMEI"
        clearable
        maxlength="32"
        show-word-limit
      ></el-input>
      <el-select v-model="searchStatus" placeholder="状态" clearable>
        <el-option
          v-for="item in statusOptions"
          :key="item.value"
          :label="item.text"
          :value="item.value"
        ></el-option>
      </el-select>
      <el-button type="primary" @click="queryData">查询</el-button>
      <el-button type="primary" @click="showGenerateDialog">生成注册码</el-button>
    </div>

    <el-table :data="tableData" stripe style="width: 100%">
      <el-table-column prop="regCode" label="注册码" header-align="center" align="center" width="180"></el-table-column>
      <el-table-column label="状态" header-align="center" align="center" width="100">
        <template #default="scope">
          <el-tag :type="getRegCodeStatusType(scope.row.used)">
            {{ getRegCodeStatusText(scope.row.used) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="usedDevice" label="使用设备" header-align="center" align="center" width="180"></el-table-column>
      <el-table-column label="使用时间" header-align="center" align="center" width="160">
        <template #default="scope">
          <span v-if="scope.row.usedTime">{{ $filters.transformTime2Minute(scope.row.usedTime) }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="days" label="有效天数" header-align="center" align="center" width="100"></el-table-column>
      <el-table-column label="过期时间" header-align="center" align="center" width="160">
        <template #default="scope">
          <span v-if="scope.row.expireTime">{{ $filters.transformTime2Minute(scope.row.expireTime) }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" header-align="center" align="center" width="160">
        <template #default="scope">
          <span v-text="$filters.transformTime2Minute(scope.row.createTime)"></span>
        </template>
      </el-table-column>
      <el-table-column label="操作" header-align="center" align="center" fixed="right" width="380">
        <template #default="scope">
          <el-button
            v-if="scope.row.used === 0"
            type="warning"
            size="small"
            @click="handleDisable(scope.row)"
          >
            禁用
          </el-button>
          <el-button
            v-if="scope.row.used === -1"
            type="success"
            size="small"
            @click="handleEnable(scope.row)"
          >
            恢复
          </el-button>
          <el-button
            v-if="scope.row.used === 0"
            type="danger"
            size="small"
            @click="handleDestroy(scope.row)"
          >
            销毁
          </el-button>
          <el-button
            v-if="scope.row.used === 0"
            type="primary"
            size="small"
            @click="handleUpdateDays(scope.row)"
          >
            修改天数
          </el-button>
          <el-button size="small" @click="handleCopy(scope.row)">复制</el-button>
        </template>
      </el-table-column>
    </el-table>

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

    <el-dialog :modal="false" title="生成注册码" v-model="generateDialogVisible" width="500px">
      <el-form ref="generateForm" :model="generateForm" :rules="generateRules">
        <el-form-item label="生成数量" :label-width="formLabelWidth" prop="count">
          <el-input-number
            v-model="generateForm.count"
            :min="1"
            :max="1000"
            controls-position="right"
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="有效天数" :label-width="formLabelWidth" prop="days">
          <el-input-number
            v-model="generateForm.days"
            :min="1"
            :max="3650"
            controls-position="right"
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="generateDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleGenerate">确 定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog :modal="false" title="修改有效天数" v-model="updateDaysDialogVisible" width="400px">
      <el-form ref="updateDaysForm" :model="updateDaysForm" :rules="updateDaysRules">
        <el-form-item label="有效天数" :label-width="formLabelWidth" prop="days">
          <el-input-number
            v-model="updateDaysForm.days"
            :min="1"
            :max="3650"
            controls-position="right"
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="updateDaysDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleConfirmUpdateDays">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  getRegCodeList,
  batchGenerateRegCode,
  distoryRegCode,
  disableRegCode,
  enableRegCode,
  updateRegCodeDays
} from '@/api/admin/regcode'
import {
  REG_CODE_STATUS_OPTIONS,
  getRegCodeStatusType,
  getRegCodeStatusText
} from '@/utils/regCodeStatus'

export default {
  name: 'RegCodeManagement',
  data() {
    return {
      tableData: [],
      searchCode: '',
      searchStatus: -3,
      statusOptions: REG_CODE_STATUS_OPTIONS,
      pageNo: 1,
      pageSize: 20,
      total: 0,
      formLabelWidth: '100px',
      generateDialogVisible: false,
      updateDaysDialogVisible: false,
      generateForm: {
        count: 10,
        days: 365
      },
      generateRules: {
        count: [{ required: true, message: '请输入生成数量', trigger: 'blur' }],
        days: [{ required: true, message: '请输入有效天数', trigger: 'blur' }]
      },
      updateDaysForm: {
        regCode: '',
        days: null
      },
      updateDaysRules: {
        days: [{ required: true, message: '请输入有效天数', trigger: 'blur' }]
      }
    }
  },
  mounted() {
    this.queryDataSilence()
  },
  methods: {
    getRegCodeStatusType,
    getRegCodeStatusText,
    applyPageResult(res) {
      if (res && res.code === 0 && res.data) {
        this.tableData = res.data.rows || []
        this.total = res.data.records || 0
        return true
      }
      this.$message({
        type: 'error',
        message: (res && res.msg) || '查询失败',
        duration: 2000
      })
      return false
    },
    queryData() {
      getRegCodeList(this.searchCode, this.pageNo, this.pageSize, this.searchStatus)
        .then((res) => {
          if (this.applyPageResult(res)) {
            this.$message({ type: 'success', message: '查询成功！', duration: 1000 })
          }
        })
        .catch((err) => {
          console.error('查询注册码失败:', err)
          this.$message({ type: 'error', message: '查询失败，请稍后重试', duration: 2000 })
        })
    },
    queryDataSilence() {
      getRegCodeList(this.searchCode, this.pageNo, this.pageSize, this.searchStatus)
        .then((res) => {
          if (res && res.code === 0 && res.data) {
            this.tableData = res.data.rows || []
            this.total = res.data.records || 0
          }
        })
        .catch((err) => {
          console.error('静默查询注册码失败:', err)
        })
    },
    handleSizeChange(val) {
      if (this.pageSize === val) return
      this.pageSize = val
      this.queryData()
    },
    handleCurrentChange(val) {
      this.pageNo = val
      this.queryData()
    },
    showGenerateDialog() {
      this.generateForm = { count: 10, days: 365 }
      this.generateDialogVisible = true
    },
    handleGenerate() {
      this.$refs['generateForm'].validate((valid) => {
        if (!valid) return
        batchGenerateRegCode(this.generateForm.count, this.generateForm.days)
          .then((res) => {
            if (res && res.code === 0) {
              this.generateDialogVisible = false
              this.queryDataSilence()
              this.$message({
                type: 'success',
                message: (typeof res.data === 'string' && res.data) || res.msg || '生成成功',
                duration: 2000
              })
            } else {
              this.$message({ type: 'error', message: (res && res.msg) || '生成失败', duration: 2000 })
            }
          })
          .catch((err) => {
            console.error('生成注册码失败:', err)
            this.$message({ type: 'error', message: '生成注册码失败，请稍后重试', duration: 2000 })
          })
      })
    },
    handleDisable(row) {
      this.$confirm('确定禁用该注册码？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          return disableRegCode(row.regCode)
        })
        .then((res) => {
          if (res && res.code === 0) {
            this.queryDataSilence()
            this.$message({ type: 'success', message: '禁用成功', duration: 1000 })
          } else {
            this.$message({ type: 'error', message: (res && res.msg) || '禁用失败', duration: 2000 })
          }
        })
        .catch((err) => {
          if (err === 'cancel' || err === 'close') return
          console.error('禁用注册码失败:', err)
          this.$message({ type: 'error', message: '禁用失败，请稍后重试', duration: 2000 })
        })
    },
    handleEnable(row) {
      this.$confirm('确定恢复该注册码？恢复后将变为未使用状态。', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => enableRegCode(row.regCode))
        .then((res) => {
          if (res && res.code === 0) {
            this.queryDataSilence()
            this.$message({ type: 'success', message: '恢复成功', duration: 1000 })
          } else {
            this.$message({ type: 'error', message: (res && res.msg) || '恢复失败', duration: 2000 })
          }
        })
        .catch((err) => {
          if (err === 'cancel' || err === 'close') return
          console.error('恢复注册码失败:', err)
          this.$message({ type: 'error', message: '恢复失败，请稍后重试', duration: 2000 })
        })
    },
    handleDestroy(row) {
      this.$confirm('确定销毁该注册码？销毁后无法恢复！', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      })
        .then(() => distoryRegCode(row.regCode))
        .then((res) => {
          if (res && res.code === 0) {
            this.queryDataSilence()
            this.$message({ type: 'success', message: '销毁成功', duration: 1000 })
          } else {
            this.$message({ type: 'error', message: (res && res.msg) || '销毁失败', duration: 2000 })
          }
        })
        .catch((err) => {
          if (err === 'cancel' || err === 'close') return
          console.error('销毁注册码失败:', err)
          this.$message({ type: 'error', message: '销毁失败，请稍后重试', duration: 2000 })
        })
    },
    handleUpdateDays(row) {
      this.updateDaysForm = {
        regCode: row.regCode,
        days: row.days
      }
      this.updateDaysDialogVisible = true
    },
    handleConfirmUpdateDays() {
      this.$refs['updateDaysForm'].validate((valid) => {
        if (!valid) return
        updateRegCodeDays(this.updateDaysForm.regCode, this.updateDaysForm.days)
          .then((res) => {
            if (res && res.code === 0) {
              this.updateDaysDialogVisible = false
              this.queryDataSilence()
              this.$message({ type: 'success', message: '修改成功', duration: 1000 })
            } else {
              this.$message({ type: 'error', message: (res && res.msg) || '修改失败', duration: 2000 })
            }
          })
          .catch((err) => {
            console.error('修改有效天数失败:', err)
            this.$message({ type: 'error', message: '修改失败，请稍后重试', duration: 2000 })
          })
      })
    },
    handleCopy(row) {
      const text = row.regCode || ''
      if (!text) {
        this.$message({ type: 'warning', message: '没有可复制的内容', duration: 1000 })
        return
      }
      const ok = () => this.$message({ type: 'success', message: '复制成功', duration: 1000 })
      const fail = () => this.$message({ type: 'error', message: '复制失败', duration: 1000 })
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          ok()
        } catch (e) {
          fail()
        }
        document.body.removeChild(ta)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.regcode-management {
  height: 100%;
  display: flex;
  flex-direction: column;

  .set-parameters {
    padding: 10px 5px;
    display: flex;
    align-items: center;
    border-bottom: solid $border-color-1 2px;

    .el-button,
    .el-select,
    .search-input {
      margin-left: 20px;
    }

    .search-input {
      width: 220px;
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
}
</style>
