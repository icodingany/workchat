<template>
  <div class="friend-circle-log">
    <!-- 日志数据 -->
    <el-table :data="friendCircleLog" stripe border style="width: 100%" highlight-current-row>
      <el-table-column label="任务类型" prop="tasktype" width="120">
        <template #default="scope">
          <span v-text="tasktypeMap[scope.row.tasktype]"></span>
        </template>
      </el-table-column>
      <el-table-column label="消息类型" width="80">
        <template #default="scope">
          <span v-text="restypeMap[scope.row.restype]"></span>
        </template>
      </el-table-column>
      <el-table-column label="微信昵称" width="180">
        <template #default="scope">
          <span v-text="wechatsNameMap[scope.row.wechatId] || scope.row.wechatId"></span>
        </template>
      </el-table-column>
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

      <el-table-column label="操作" width="150">
        <!--  -1暂停     1开启中     0已完成    2取消 -->
        <template #default="{ row }">
          <el-button v-if="row.state === 1" link  @click="modifyState(row, -1)">暂停</el-button>
          <el-button v-if="row.state === -1" link  @click="modifyState(row, 1)">继续</el-button>
          <el-button v-if="row.state === 1 || row.state === -1" link  @click="modifyState(row, 2)">
            取消
          </el-button>
          <el-button link  @click="getAutoTaskDetail(row)">详情</el-button>
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
    <el-dialog append-to-body class="task-detail" title="任务详情" v-model="taskDetailVisiable">
      <div
        style="width: 50%"
        :class="[
          {
            'chat-link': rowDetail.restype === 6
          },
          {
            'chat-app': rowDetail.restype === 13
          }
        ]"
        v-html="decodeCircle(rowDetail)"
      ></div>

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
          <el-button  @click="taskDetailVisiable = false">确 定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { getTaskInfoList, getTaskDetail, updateTaskState } from '@/api/httpApi'

export default {
  name: 'FriendCircleLog',
  data() {
    return {
      friendCircleLog: [], // 群发日志
      tasktypeMap: {
        1: '群发我的客户',
        2: '群发企业联系人',
        3: '群发群聊',
        4: '发朋友圈'
      }, // 任务类型
      restypeMap: {
        '-1': '文本',
        0: '图片',
        1: '视频',
        2: '链接'
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
        4
        // '',
      ).then((res) => {
        console.log(res)
        if (res.code === 0) {
          this.friendCircleLog = res.data.list || []
          this.totalNum = res.data.total || 0
        }
      })
    },
    // 查询任务详情
    getAutoTaskDetail(row) {
      this.rowDetail = row
      this.taskDetail = {}
      getTaskDetail(row.id).then((res) => {
        console.log(res)
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
          for (const gsl of this.friendCircleLog) {
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
    },
    // 解析内容
    decodeCircle(circleData) {
      let content = circleData.content || ''
      let regJson = new RegExp(/^{.+}$/)
      let jContent = {}
      let thumb = ''
      let str = ''
      if (typeof content === 'string' && regJson.test(content)) {
        jContent = JSON.parse(content)
      }
      switch (circleData.restype) {
        // 文本 1
        case 'Text':
        case -1:
          return content
        // 图片 2
        case 'Picture':
        case 0:
          //   return `<img class="chat-img" src="${content}"  alt="图片"/>`
          return content
        // 视频 4
        case 'Video':
        case 1:
          return `<video class="video-box" src="${jContent.url}" type="video/mp4" alt="视频" controls></video>`
        // 链接消息 6
        case 'Link':
        case 2:
          str = `
                          <span class="link-title">${jContent.title}</span>
                          <div class="link-content">
                            <span class="link-des">${jContent.desc ? jContent.desc : ''}</span>
                            <img class="link-img" src="${jContent.thumbUrl}" alt="链接图片" />
                          </div>
                          <div class="link-type">链接</div>
          `
          return str
        // 不支持的消息
        default:
          return `不支持的消息类型${circleData.ContentType}`
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.friend-circle-log {
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
