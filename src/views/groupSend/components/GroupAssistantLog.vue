<template>
  <div class="group-assistant-log">
    <!-- 群发对象 -->
    <el-radio-group class="log-type" v-model="logTab">
      <el-radio-button value="1">我的客户</el-radio-button>
      <el-radio-button value="2">企业联系人</el-radio-button>
      <el-radio-button value="3">群聊</el-radio-button>
    </el-radio-group>

    <!-- 日志数据 -->
    <el-table :data="groupSendLog" stripe border style="width: 100%" highlight-current-row>
      <el-table-column label="任务类型" prop="tasktype">
        <template #default="scope">
          <span v-text="tasktypeMap[scope.row.tasktype]"></span>
        </template>
      </el-table-column>
      <!-- <el-table-column label="消息类型">
        <template #default="scope">
          <span v-text="restypeMap[scope.row.restype]"></span>
        </template>
      </el-table-column> -->
      <el-table-column label="微信昵称">
        <template #default="scope">
          <span v-text="wechatsNameMap[scope.row.wechatId] || scope.row.wechatId"></span>
        </template>
      </el-table-column>
      <el-table-column label="当前状态" prop="state" :formatter="taskStateFormatter"></el-table-column>
      <!-- <el-table-column label="备注" prop="remarks"></el-table-column> -->
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
      <el-table-column label="操作">
        <!--  -1暂停     1开启中     0已完成    2取消 -->
        <template #default="{ row }">
          <el-button v-if="row.state === 1" link @click="modifyState(row, -1)">暂停</el-button>
          <el-button v-if="row.state === -1" link @click="modifyState(row, 1)">继续</el-button>
          <el-button v-if="row.state === 1 || row.state === -1" link @click="modifyState(row, 2)">
            取消
          </el-button>
          <el-button link @click="getAutoTaskDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="send-operation">
      <!-- 分页 -->
      <el-pagination
        :current-page="currentPage"
        :page-sizes="[20, 40, 60, 80]"
        :page-size="pageSize"
        :pager-count="7"
        layout="total, sizes, prev, pager, next, jumper"
        :total="totalNum"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      ></el-pagination>
      <!-- 刷新日志 -->
      <el-button style="position: absolute; bottom: 5px; right: 20px" @click="queryLogData">刷新日志</el-button>
    </div>

    <!-- 任务详情 -->
    <el-dialog append-to-body class="task-detail-dialog" title="任务详情" v-model="taskDetailVisiable">
      <div class="preview-box">
        <div class="preview-list">
          <div v-for="(rowItem, index) in rowDetail" :key="index" class="preview-item">
            <img style="height: 28px; margin-right: 5px" src="@/assets/images/group/prevideAvatar.png" alt="" />

            <p v-if="rowItem.ContentType === 'Text'" class="preview-item-bg" style="line-height: 30px">
              {{ rowItem.Content }}
            </p>
            <img
              v-if="rowItem.ContentType === 'Picture'"
              :src="rowItem.Content"
              style="max-width: 100px; max-height: 100px"
              alt=""
            />
            <div v-if="rowItem.ContentType === 'Link'" class="preview-item-bg preview-item-link">
              <p
                style="width: 160px; font-weight: 600; font-size: 14px; line-height: 30px"
                class="ellipsis"
                v-text="rowItem.jContent.title"
              ></p>
              <el-row type="flex" align="middle" justify="space-between">
                <p style="font-size: 12px" class="ellipsis-3" v-text="rowItem.jContent.desc"></p>
                <el-image style="width: 60px; min-width: 60px; height: 60px" :src="rowItem.jContent.thumbUrl">
                  <template #error>
                    <div class="image-slot">
                      <img src="@/assets/images/group/link2.png" alt="" />
                    </div>
                  </template>
                </el-image>
              </el-row>
            </div>
            <div v-if="rowItem.ContentType === 'WeApp'" class="preview-item-bg" style="width: 170px">
              <p
                style="width: 160px; font-weight: 600; font-size: 14px; line-height: 30px"
                class="ellipsis"
                v-text="rowItem.jContent.appName"
              ></p>
              <el-image style="width: 160px; min-width: 160px" :src="rowItem.jContent.thumbUrl">
                <template #error>
                  <div class="image-slot">
                    <img style="margin-left: 16px" src="@/assets/images/group/weApp.png" alt="" />
                  </div>
                </template>
              </el-image>
              <el-row type="flex" align="middle" style="height: 30px">
                <img
                  style="widht: 18px; height: 18px; margin-right: 5px; border-radius: 50%"
                  :src="rowItem.jContent.iconUrl"
                  alt=""
                />
                <p style="font-size: 10px; color: #a8a8a8">小程序</p>
              </el-row>
            </div>
          </div>
        </div>
      </div>

      <ul class="detail-ls">
        <li>
          <p style="width: 120px" v-text="'任务总数'"></p>
          <p v-text="taskDetail.task_allSize"></p>
        </li>
        <li>
          <p style="width: 120px" v-text="'执行中的任务数'"></p>
          <p v-text="taskDetail.task_startSize"></p>
        </li>
        <li>
          <p style="width: 120px" v-text="'暂停的任务数'"></p>
          <p v-text="taskDetail.task_stopSize"></p>
        </li>
        <li>
          <p style="width: 120px" v-text="'取消的任务数'"></p>
          <p v-text="taskDetail.task_cancelSize"></p>
        </li>
        <li>
          <p style="width: 120px" v-text="'失败的任务数'"></p>
          <p v-text="taskDetail.task_failSize"></p>
        </li>
        <li>
          <p style="width: 120px" v-text="'结束的任务数'"></p>
          <p v-text="taskDetail.task_endSize"></p>
        </li>
        <li>
          <p style="width: 120px" v-text="'成功的任务数'"></p>
          <p v-text="taskDetail.task_successSize"></p>
        </li>
      </ul>
      <template #footer>
        <span>
          <el-button size="medium" @click="taskDetailVisiable = false">确 定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { getTaskInfoList, getTaskDetail, updateTaskState } from '@/api/httpApi'
import errorImg from '@/assets/svg/conversation-image-error.svg'

export default {
  name: 'GroupAssistantLog',
  data() {
    return {
      logTab: 1, //  1、群发客户；2、群发联系人；3、群发群聊
      groupSendLog: [], // 群发日志
      tasktypeMap: {
        1: '群发我的客户',
        2: '群发企业联系人',
        3: '群发群聊'
        // 4: '删除群聊',
        // 5: '群发群消息',
        // 6: '按标签群发',
        // 7: '发朋友圈',
        // 8: '批量加好友'
      }, // 任务类型
      restypeMap: {
        Text: 1,
        Picture: 2,
        Voice: 3,
        Video: 4,
        Link: 6,
        WeApp: 13,
        1: '文本',
        2: '图片',
        3: '语音',
        4: '视频',
        6: '链接',
        13: '小程序'
      }, // 消息类型
      pageSize: 20,
      currentPage: 1,
      totalNum: 0,
      taskDetail: {}, // 任务详情
      rowDetail: {}, // 任务详情
      taskDetailVisiable: false // 任务详情可见
    }
  },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      wechatsNameMap: 'conversation/wechatsNameMap'
    })
  },
  watch: {
    logTab(val) {
      this.queryLogData()
    }
  },
  created() {
    // 查询日志
    if (this.currentUser.UnionId) {
      this.queryLogData()
    }
  },
  methods: {
    // 查询日志
    queryLogData() {
      getTaskInfoList(
        this.currentUser.UnionId,
        this.currentPage,
        this.pageSize,
        this.logTab
        // '',
      ).then((res) => {
        console.log(res)
        if (res.code === 0) {
          this.groupSendLog = res.data.list || []
          this.totalNum = res.data.total || 0
        }
      })
    },
    // 查询任务详情
    getAutoTaskDetail(row) {
      this.rowDetail = JSON.parse(row.content)
      console.log(this.rowDetail)
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
          for (const gsl of this.groupSendLog) {
            if (gsl.id === row.id) {
              gsl.state = state
              break
            }
          }
          // this.$message.success('修改任务状态成功！')
        }
      })
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
    // 修改pageSize
    handleSizeChange(val) {
      if (this.pageSize === val) return
      this.pageSize = val
      this.queryLogData()
    },
    // 修改当前页
    handleCurrentChange(val) {
      this.currentPage = val
      this.queryLogData()
    }
  }
}
</script>

<style lang="scss" scoped>
.group-assistant-log {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .log-type {
    margin-bottom: 10px;
  }

  .send-operation {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 50px;
  }
}
</style>
