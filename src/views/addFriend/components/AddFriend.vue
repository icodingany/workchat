<template>
  <div class="add-friend">
    <!-- 设置参数 -->
    <el-form

      label-width="100px"
      ref="addFriendFormRef"
      :rules="rules"
      :model="addFriendForm"
      class="add-form"
    >
      <el-form-item class="add-item" label="输入号码：" prop="number">
        <el-input v-model="addFriendForm.number" maxlength="20" clearable placeholder="微信号/QQ号/手机号"></el-input>
      </el-form-item>
      <el-form-item class="add-item" label="验证消息：">
        <el-input v-model="addFriendForm.message" maxlength="50" clearable placeholder="选填"></el-input>
      </el-form-item>
      <el-form-item class="add-item" label="设置备注：">
        <el-input v-model="addFriendForm.memo" maxlength="50" clearable placeholder="选填"></el-input>
      </el-form-item>
      <el-form-item class="add-item" label="设置标签：">
        <el-input v-model="addFriendForm.labels" maxlength="50" clearable placeholder="选填"></el-input>
      </el-form-item>
      <el-form-item class="add-item">
        <el-button type="primary" @click="onSubmit">立即添加</el-button>
      </el-form-item>
    </el-form>

    <!-- 历史任务 -->
    <el-table :data="tableData" stripe border>
      <el-table-column label="输入号码" prop="Key"></el-table-column>
      <el-table-column label="验证消息" prop="Msg"></el-table-column>
      <el-table-column label="备注名" prop="Memo"></el-table-column>
      <el-table-column label="标签" prop="Labels"></el-table-column>
      <el-table-column label="时间">
        <template #default="scope">
          <span v-text="$filters.timeFilter(scope.row.TaskId)"></span>
        </template>
      </el-table-column>
      <el-table-column label="结果" prop="result"></el-table-column>
    </el-table>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { AddCustomerFromSearchTask } from '@/api/webSocketApi'

export default {
  name: 'AddFriend',
  data() {
    return {
      // 要提交的表单
      addFriendForm: {
        number: '',
        message: '',
        memo: '',
        labels: ''
      },
      // 表单验证
      rules: {
        number: [
          { required: true, message: '请输入微信号/QQ号/手机号', trigger: 'blur' },
          { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    ...mapGetters({
      userId: 'userId',
      currentWeChatId: 'conversation/currentWeChatId'
    }),
    tableData() {
      return this.$store.getters['tools/addFriendsHistory']
    }
  },
  watch: {
    currentWeChatId(newId) {
      this.$store.dispatch('tools/SetAddCustomerFromSearchTask', newId)
    }
  },
  created() {
    this.$store.dispatch('tools/SetAddCustomerFromSearchTask', this.currentWeChatId)
  },
  methods: {
    // 提交表单
    onSubmit() {
      let wechatId = this.currentWeChatId
      //   如果没有选择微信 给出提示
      if (wechatId) {
        // 如果通过验证 提交表单
        this.$refs['addFriendFormRef'].validate((valid) => {
          if (valid) {
            const { number, message, memo, labels } = this.addFriendForm
            AddCustomerFromSearchTask(wechatId, number, message, memo, [labels], this.userId)
            // 重置表单
            this.resetForm()
          } else {
            this.$message({
              message: '请检查输入号码！',
              type: 'error'
            })
            return false
          }
        })
      } else {
        this.$message({
          message: '请先选择微信！',
          type: 'warning'
        })
      }
    },
    // 重置表单
    resetForm(formName = 'addFriendFormRef') {
      this.$refs[formName].resetFields()
    }
  }
}
</script>

<style lang="scss" scoped>
.add-friend {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .add-form {
    display: flex;
    align-items: center;
    // border-bottom: solid black 5px;

    .add-item {
      margin-bottom: 0;
      margin: 10px 0 20px 0;
    }
  }
}
</style>
