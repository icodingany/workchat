<template>
  <div class="add-friend-from-wx">
    <!-- 提交表单 -->
    <el-form
      label-width="100px"
      ref="addFriendFromWxFormRef"
      :rules="rules"
      :model="addFriendFromWxForm"
      class="add-form"
    >
      <el-form-item class="add-item" label="起始位置" prop="startNumber">
        <el-input
          v-model="addFriendFromWxForm.startNumber"
          maxlength="4"
          clearable
          :placeholder="'添加的起始位置0-' + friendsCount + '不包括最后一个'"
        ></el-input>
      </el-form-item>
      <el-form-item class="add-item" label="添加的个数" prop="totalNumber">
        <el-input v-model="addFriendFromWxForm.totalNumber" maxlength="4" clearable placeholder="添加的个数"></el-input>
      </el-form-item>
      <el-form-item class="add-item" label="招呼语">
        <el-input v-model="addFriendFromWxForm.message" maxlength="50" clearable placeholder="选填"></el-input>
      </el-form-item>
      <el-form-item class="add-item">
        <el-button type="primary" @click="addFriendFromWx">立即添加</el-button>
        <el-button @click="queryWeChatFriends">获取微信好友</el-button>
      </el-form-item>
    </el-form>

    <!-- 预览 -->
    <el-table :data="tableData[currentPage - 1] || []" stripe border>
      <el-table-column type="index" :index="indexMethod" label="序号" width="100"></el-table-column>
      <el-table-column prop="Name" label="昵称" width="180"></el-table-column>
      <el-table-column label="头像" width="180">
        <template #default="scope">
          <el-avatar style="background: white" :size="40" :src="scope.row.Avatar + '/0'">
            <img
              style="width: 40px; height: 40px; margin: 10px"
              src="../../../assets/svg/conversation-image-error.svg"
            />
          </el-avatar>
        </template>
      </el-table-column>
      <el-table-column prop="OpenId" label="openId"></el-table-column>
      <el-table-column prop="UnionId" label="unionId"></el-table-column>
      <el-table-column label="操作">
        <template #default="scope">
          <el-button v-if="scope.row.HasSent" type="info">已发邀请</el-button>
          <el-button v-else type="primary" @click="addFriendByOpenId(scope.row)">添加</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
      :current-page="currentPage"
      :page-sizes="[15, 30, 45, 60]"
      :page-size="pageSize"
      :pager-count="5"
      layout="total, sizes, prev, pager, next, jumper"
      :total="friendsCount"
    ></el-pagination>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { triggerWechatFriendPushTask, addCustomerFromWxTask, addCustomerByIdTask } from '@/api/webSocketApi'

export default {
  name: 'AddFriendFromWx',
  data() {
    let checkStartNumber = (rule, value, callback) => {
      value = Number(value)
      if (!Number.isInteger(value)) {
        callback(new Error('请输入数字值'))
      } else {
        if (value < 0) {
          callback(new Error('必须大于等于0'))
        } else if (value > this.friendsCount) {
          callback(new Error('必须小于好友总数！'))
        } else {
          callback()
        }
      }
    }
    let checkTotalNumber = (rule, value, callback) => {
      value = Number(value)
      if (!Number.isInteger(value)) {
        callback(new Error('请输入数字值'))
      } else {
        if (value < 0) {
          callback(new Error('必须大于0'))
        } else if (value > this.friendsCount - 1 - this.addFriendFromWxForm.startNumber) {
          callback(new Error('起使位置和添加个数之和必须小于好友总数！'))
        } else {
          callback()
        }
      }
    }
    return {
      pageSize: 15,
      currentPage: 1,
      // 要提交的表单
      addFriendFromWxForm: {
        startNumber: '',
        totalNumber: '',
        message: ''
      },
      // 表单验证
      rules: {
        startNumber: [
          { required: true, message: '起使位置不能为空', trigger: 'blur' },
          { validator: checkStartNumber, trigger: 'blur' }
        ],
        totalNumber: [
          { required: true, message: '添加数不能为空', trigger: 'blur' },
          { validator: checkTotalNumber, trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    ...mapGetters({
      wxFriends: 'tools/wxFriends',
      currentWeChatId: 'conversation/currentWeChatId'
    }),
    friendsCount() {
      const list = (this.wxFriends && this.wxFriends.Friends) || []
      // 分页总数与实际列表对齐，避免 Count 超前导致空页
      return list.length
    },
    tableData() {
      let size = this.pageSize
      let newFriends = []
      let friends = (this.wxFriends && this.wxFriends.Friends) || []
      for (let i = 0; i < friends.length; i += size) {
        newFriends.push(friends.slice(i, i + size))
      }
      return newFriends
    }
  },
  watch: {
    currentWeChatId() {
      this.currentPage = 1
      this.$store.commit('tools/RESET_WX_FRIENDS')
    },
    friendsCount(val) {
      const maxPage = Math.max(1, Math.ceil(val / this.pageSize) || 1)
      if (this.currentPage > maxPage) {
        this.currentPage = maxPage
      }
    }
  },
  methods: {
    // 查询通讯里好友
    queryWeChatFriends() {
      if (this.currentWeChatId) {
        this.currentPage = 1
        this.$store.commit('tools/RESET_WX_FRIENDS')
        triggerWechatFriendPushTask(this.currentWeChatId)
      } else {
        this.$message.warning('请先选中微信！')
      }
    },
    // 计算序号
    indexMethod(index) {
      return (this.currentPage - 1) * this.pageSize + index
    },
    // 修改pageSize
    handleSizeChange(val) {
      if (this.pageSize === val) return
      this.pageSize = val
    },
    // 修改当前页
    handleCurrentChange(val) {
      this.currentPage = val
    },
    // 提交表单
    addFriendFromWx() {
      // 加之前先获取微信好友列表
      if (this.wxFriends.Friends && this.wxFriends.Friends.length === 0) {
        this.$message.warning('请先获取微信好友列表！')
        return
      }
      let wechatId = this.currentWeChatId
      //   如果没有选择微信 给出提示
      if (wechatId) {
        // 如果通过验证 提交表单
        this.$refs['addFriendFromWxFormRef'].validate((valid) => {
          if (valid) {
            const { startNumber, totalNumber, message } = this.addFriendFromWxForm
            addCustomerFromWxTask(wechatId, totalNumber, startNumber, message)
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
    resetForm(formName = 'addFriendFromWxFormRef') {
      this.$refs[formName].resetFields()
    },
    // 通过opid加好友
    addFriendByOpenId(row) {
      addCustomerByIdTask(this.currentWeChatId, [row.OpenId], '')
    }
  }
}
</script>

<style lang="scss" scoped>
.add-friend-from-wx {
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
