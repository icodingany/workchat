<template>
  <div class="add-friend-auto">
    <div class="upload-excel">
      <upload-excel-component
        :on-success="handleSuccess"
        :before-upload="beforeUpload"
        @handleClear="clearPhonesList"
      />
      <p style="margin: 10px">共{{ phonesList.length }}个号码</p>
      <div>
        自动分配
        <el-switch v-model="autoDistribution"  active-color="#576C95" inactive-color="#EEEEEE"></el-switch>
      </div>
      <!-- <el-table :data="tableData" border highlight-current-row style="width: 100%; margin-top: 20px">
        <el-table-column v-for="item of tableHeader" :key="item" :prop="item" :label="item" />
      </el-table> -->
    </div>

    <!-- 微信列表 -->
    <div class="wechat-list scroll">
      <div v-for="(wechat, index) in wechatsOnline" :key="index" class="wechat-info">
        <div class="avatar-info">
          <el-avatar :size="44" :src="wechat.Avatar">
            <i class="fa fa-picture-o" aria-hidden="true" title="头像miss"></i>
          </el-avatar>
          <div class="other-info">
            <p class="ellipsis" style="color: #333333; font-size: 14px" :title="wechat.Name" v-text="wechat.Name"></p>
            <p class="ellipsis" :title="wechat.deviceid || wechat.IMEI" v-text="wechat.deviceid || wechat.IMEI"></p>
          </div>
        </div>
        <div class="number-input">
          <span>添加数量</span>
          <el-input-number
            v-model="numberMap[wechat.WxId]"
            style="width: 100px; margin: 0 7px"

            :min="0"
            :max="limitNumber"
            :step="1"
            step-strictly
            :disabled="autoDistribution"
          ></el-input-number>
          个
        </div>
      </div>
    </div>

    <!-- 操作 -->
    <div class="add-friend-auto-oprations">
      <div class="break-time">
        <span class="tip">时间间隔(分)</span>
        <el-input-number
          v-model="breakTime"

          controls-position="right"
          :min="1"
          :max="59"
          style="margin: 0 5px; width: 90px"
        ></el-input-number>
      </div>
      <div class="start-time">
        <span class="tip">起始时间</span>
        <el-date-picker
          v-model="startTime"
          type="datetime"
          placeholder="选择日期时间"
          clearable

        ></el-date-picker>
      </div>
      <el-button

        type="info"
        plain
        style="color: #999999; background: #fff; border: solid 1px #dadada"
        @click="showTaskDialog"
      >
        任务日志
      </el-button>
      <el-button

        type="primary"
        style="color: #fff; background: #ff9f00; border: solid 1px #ff9f00"
        :loading="sending"
        @click="sureSend"
      >
        创建任务
      </el-button>
    </div>

    <!-- 任务日志 -->
    <el-dialog append-to-body title="批量加好友日志" v-model="taskLogVisiable">
      <el-table :data="addFriendsLog" stripe max-height="500px">
        <el-table-column label="任务类型" prop="tasktype" width="120">
          <template #default="scope">
            <span v-text="tasktypeMap[scope.row.tasktype]"></span>
          </template>
        </el-table-column>
        <el-table-column label="微信昵称">
          <template #default="scope">
            <span v-text="wechatsNameMap[scope.row.wechatId] || scope.row.wechatId"></span>
          </template>
        </el-table-column>
        <!-- <el-table-column label="号码信息">
          <template #default="{ row }">
            <div class="phone-info" v-for="(phoneItem, index) in JSON.parse(row.content)" :key="index">
              <span v-text="phoneItem.phoneNumber"></span>
              <span v-text="phoneItem.label"></span>
            </div>
          </template>
        </el-table-column> -->
        <!-- <el-table-column label="手机号码" prop="content"></el-table-column> -->
        <el-table-column label="当前状态" prop="state" width="80" :formatter="taskStateFormatter"></el-table-column>
        <el-table-column label="预计执行时间" prop="execute_time"></el-table-column>
        <el-table-column label="实际执行时间" prop="update_time">
          <template #default="scope">
            <span
              v-if="scope.row.update_time"
              v-text="$filters.transformTime2Minute(scope.row.update_time)"
            ></span>
            <span v-else v-text="'待执行'"></span>
          </template>
        </el-table-column>
        <!-- <el-table-column label="加人间隔" prop="between_time"></el-table-column> -->
        <el-table-column label="操作" width="150">
          <!--  -1暂停     1开启中     0已完成    2取消 -->
          <template #default="{ row }">
            <el-button v-if="row.state === 1" link  @click="modifyState(row, -1)">暂停</el-button>
            <el-button v-if="row.state === -1" link  @click="modifyState(row, 1)">继续</el-button>
            <el-button v-if="row.state === 1 || row.state === -1" link  @click="modifyState(row, 2)">
              取消
            </el-button>
            <el-button v-if="row.state === 2" link >已取消</el-button>
            <!-- <el-button link  @click="getAutoTaskDetail(row)">号码详情</el-button> -->
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <Pagination
        v-show="totalNum > 0"
        :total="totalNum"
        v-model:page="pageNum"
        v-model:limit="pageSize"
        @pagination="queryLogs"
      />
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { addTaskTimeInfo, getTaskInfoList, getTaskDetail, updateTaskState } from '@/api/httpApi'

import UploadExcelComponent from '@/components/UploadExcel/index.vue'
import Pagination from '@/components/Pagination'

export default {
  name: 'ToolsAddFriendAuto',
  components: {
    UploadExcelComponent,
    Pagination
  },
  data() {
    return {
      phonesList: [], // 号码列表
      //   tableData: [],
      //   tableHeader: [],

      autoDistribution: false, // 自动分配
      numberMap: {}, // 每个微信的添加数量
      limitNumber: 15, // 添加上限

      tasktypeMap: {
        1: '群发我的客户',
        2: '群发企业联系人',
        3: '群发群聊',
        4: '发朋友圈',
        5: '批量加好友'
      }, // 任务类型

      startTime: new Date().getTime(), // 添加的起始时间
      breakTime: 1, // 添加的间隔时间

      taskLogVisiable: false, // 显示日志
      sending: false, // 显示日志
      addFriendsLog: [],
      totalNum: 0,
      pageSize: 10, // 每页几个数据
      pageNum: 1 // 当前页
    }
  },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      wechatsOnline: 'conversation/wechatsOnline',
      wechatsNameMap: 'conversation/wechatsNameMap'
    })
  },
  watch: {
    // 监听自动分配
    autoDistribution(val) {
      if (val) {
        this.autoDispatch()
      }
    }
  },
  created() {
    // 设置每个微信加的初始值
    this.wechatsOnline.forEach((e) => {
      this.numberMap[e.WxId] = 0
    })
  },
  methods: {
    // 文件不能大于10M
    beforeUpload(file) {
      const isLtM = file.size / 1024 / 1024 < 10

      if (isLtM) {
        return true
      }

      this.$message({
        message: 'Please do not upload files larger than 1m in size.',
        type: 'warning'
      })
      return false
    },
    // 文件上传成功之后
    handleSuccess({ results, header }) {
      this.phonesList = results
      //   this.tableData = results
      //   this.tableHeader = header
    },
    clearPhonesList() {
      this.phonesList = []
    },
    // 自动分配号码
    autoDispatch() {
      const eachP = this.phonesList.length / this.wechatsOnline.length
      this.wechatsOnline.forEach((e, index) => {
        if (index === this.wechatsOnline.length - 1) {
          this.numberMap[e.WxId] = Math.floor(eachP)
        } else {
          this.numberMap[e.WxId] = Math.round(eachP)
        }
      })
    },
    // 时间戳转换成 2020-09-21 16:44
    transformTime(times) {
      const date = new Date(times)
      const Y = date.getFullYear() + '-'
      const M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
      const D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ' '
      const h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':'
      const m = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()
      // let s = date.getSeconds()
      const time = Y + M + D + h + m
      return time
    },
    // 提交表单
    sureSend() {
      if (this.phonesList.length === 0) {
        this.$alert('请先选择号码！', '提示', { type: 'warning' })
        return
      }
      this.sending = true
      for (const key in this.numberMap) {
        const message = {
          accountid: this.currentUser.UnionId,
          tasktype: 5, // 4发朋友圈 5批量加好友
          state: 1, // 状态1开启中0已完成
          execute_time: this.transformTime(this.startTime), // 执行时间
          between_time: this.breakTime,
          wechatId: key,
          friendAddList: []
          // msg:'', // 招呼语
          // memo:'' // 备注名
        }
        if (this.numberMap.hasOwnProperty(key)) {
          let numbers2send = this.phonesList.slice(0, this.numberMap[key])
          message.friendAddList = numbers2send.map((x) => {
            x = JSON.stringify(x)
            return x
          })
          //   message.friendAddList = JSON.stringify(numbers2send)
          message.content = JSON.stringify(numbers2send)
          addTaskTimeInfo(message)
            .then((res) => {
              if (res.code === 0) {
                this.$message.success('创建成功！')
              }
            })
            .catch(() => {
              this.$message.warning('创建失败！')
            })
          this.phonesList = this.phonesList.slice(this.numberMap[key])
        }
      }
      let sendTimer = setTimeout(() => {
        this.sending = false
        clearTimeout(sendTimer)
      }, 1000)
    },
    // 任务状态格式化
    taskStateFormatter(row) {
      const stateMap = {
        '-1': '暂停',
        0: '已完成',
        1: '开启中',
        2: '取消'
      }
      return stateMap[row.state]
    },
    // 获取并显示批量加好友任务列表
    showTaskDialog() {
      this.queryLogs()
      this.taskLogVisiable = !this.taskLogVisiable
    },
    // 查看日志
    queryLogs() {
      getTaskInfoList(this.currentUser.UnionId, this.pageNum, this.pageSize, 5).then(
        (res) => {
          if (res.code === 0) {
            this.addFriendsLog = res.data.list || []
            this.totalNum = res.data.total || 0
          }
        }
      )
    },
    // 查询任务详情
    getAutoTaskDetail(row) {
      this.rowDetail = row
      this.taskDetail = {}
      getTaskDetail(row.id).then((res) => {
        if (res.code === 0 && res.data) {
          this.taskDetail = res.data
          this.taskDetailVisiable = true
        }
      })
    },
    // 修改任务状态
    modifyState(row, state) {
      updateTaskState(row.id, state).then((res) => {
        if (res.code === 0) {
          for (const gsl of this.addFriendsLog) {
            if (gsl.id === row.id) {
              gsl.state = state
              break
            }
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
:deep(.phone-info) {
  //   border: solid red 1px;
  display: flex;
  flex-wrap: wrap;
}

.add-friend-auto {
  flex: 1 1 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .wechat-list {
    flex: 1 1 auto;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    overflow: auto;

    .wechat-info {
      width: 220px;
      height: 147px;
      border: solid #eeeeee 1px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      flex-direction: column;
      font-size: 14px;
      color: #999999;
      margin: 5px 5px 5px 0;
      justify-content: space-between;

      .avatar-info {
        flex: 1 1 auto;
        display: flex;
        align-items: center;

        .other-info {
          display: flex;
          flex-direction: column;
          p {
            padding: 5px 10px;
            font-size: 12px;
            width: 150px;
          }
        }
      }
      .number-input {
        width: 100%;
        height: 49px;
        font-size: 12px;
        color: #333333;
        border-radius: 0 0 5px 5px;
        background-color: #f8f8f8;

        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  .upload-excel {
    height: 200px;
    min-height: 200px;
    overflow: hidden;
    display: flex;
    align-items: center;
  }

  .add-friend-auto-oprations {
    height: 50px;
    min-height: 50px;
    width: 100%;
    background-color: #f9f9f9;
    font-size: 14px;
    color: #333333;
    display: flex;
    align-items: center;
    padding: 0 20px;
    .break-time,
    .start-time {
      padding: 0 25px 0 0;
      .tip {
        margin-right: 10px;
        font-size: 16px;
      }
    }
  }
}
</style>
