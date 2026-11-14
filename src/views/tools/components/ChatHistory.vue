<template>
  <div class="chat-history">
    <el-row style="margin-bottom: 10px" type="flex" align="middle">
      <el-select v-model="wechat2query" style="width: 200px"  clearable placeholder="请选择微信">
        <el-option v-for="wechat in wechats" :key="wechat.WxId" :label="wechat.Name" :value="wechat.WxId"></el-option>
      </el-select>

      <el-input
        style="margin-left: 10px; width: 150px"

        v-model="friendId"
        clearable
        placeholder="好友id"
      ></el-input>
      <el-input
        style="margin-left: 10px; width: 150px"

        v-model="chatKey"
        clearable
        placeholder="关键词"
      ></el-input>
      <el-date-picker
        style="margin-left: 10px; width: 350px"

        v-model="timePick"
        type="datetimerange"
        :shortcuts="shortcuts"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        align="right"
      ></el-date-picker>
      <el-button style="margin-left: 10px"  type="primary" @click="queryChats">查询</el-button>
    </el-row>
    <el-table :data="resChats" stripe border>
      <el-table-column label="所属微信" prop="wxId">
        <template #default="{ row }">
          <span v-text="wechatsNameMap[row.wxId] || row.wxId"></span>
        </template>
      </el-table-column>
      <!-- <el-table-column label="主动发出" prop="isSend"></el-table-column> -->
      <el-table-column label="发送者" prop="senderId">
        <template #default="{ row }">
          <span v-text="row.senderName || row.senderId"></span>
        </template>
      </el-table-column>
      <!-- <el-table-column label="convId" prop="convId"></el-table-column> -->
      <!-- <el-table-column label="senderId" prop="senderId"></el-table-column> -->
      <el-table-column label="接收者" prop="convId">
        <template #default="{ row }">
          <span v-if="row.senderId === row.convId" v-text="wechatsNameMap[row.wxId] || row.wxId"></span>
          <span v-else v-text="allContactsNameMap[row.convId] || row.convId"></span>
        </template>
      </el-table-column>
      <el-table-column label="消息类型" prop="contentType">
        <template #default="{ row }">
          <span v-text="contentTypeMap[row.contentType] || row.contentType"></span>
        </template>
      </el-table-column>
      <el-table-column label="内容" prop="content"></el-table-column>
      <el-table-column label="时间">
        <template #default="scope">
          <span v-text="$filters.timeFilter(scope.row.msgTime || scope.row.msg_time || scope.row.CreateTime)"></span>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      v-show="totalChats > 0"
      :total="totalChats"
      v-model:page="pageNo"
      v-model:limit="pageSize"
      @pagination="queryChats"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { queryChatHistory } from '@/api/httpApi'
import Pagination from '@/components/Pagination'

export default {
  name: 'NewFriends',
  components: {
    Pagination
  },
  data() {
    return {
      wechat2query: '', // 要查询的好友昵称
      friendId: '', // 要查询的好友昵称
      chatKey: '', // 关键词
      contentTypeMap: {
        0: '未知',
        1: '文本',
        2: '图片',
        3: '语音',
        4: '视频',
        5: '系统消息',
        6: '链接消息',
        7: '扩展链接',
        8: '文件',
        9: '名片',
        10: '位置信息',
        11: '红包',
        12: '转账',
        13: '小程序',
        14: 'Emoji',
        15: '群管理消息',
        16: '红包系统消息',
        17: '群系统消息',
        18: '公众号文章',
        19: '语音通话',
        20: '视频通话',
        21: '服务通知',
        22: '引用消息',
        23: '聊天记录',
        24: '朋友圈通知',
        25: '视频号',
        26: '功能卡片',
        99: '不支持的消息'
      },
      // element-plus 的 date-picker shortcuts：value 是返回 [start, end] 的函数（旧 element-ui 用 onClick + picker.$emit）
      shortcuts: [
        {
          text: '最近一周',
          value() {
            const end = new Date()
            const start = new Date()
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
            return [start, end]
          }
        },
        {
          text: '最近一个月',
          value() {
            const end = new Date()
            const start = new Date()
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
            return [start, end]
          }
        },
        {
          text: '最近三个月',
          value() {
            const end = new Date()
            const start = new Date()
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
            return [start, end]
          }
        }
      ],
      timePick: '',
      //   timePick: [new Date(2000, 10, 10, 10, 10), new Date(2000, 10, 11, 10, 10)],
      resChats: [], // 返回的历史消息
      totalChats: 0, // 返回的历史消息
      pageNo: 1, // 返回的历史消息
      pageSize: 10 // 返回的历史消息
    }
  },
  computed: {
    ...mapGetters({
      currentUser: 'currentUser',
      wechats: 'conversation/wechats',
      wechatsNameMap: 'conversation/wechatsNameMap',
      allContactsNameMap: 'conversation/allContactsNameMap'
    })
  },

  created() {
    this.$store.dispatch('conversation/SetAllContacts')
  },
  methods: {
    // 查询历史消息
    queryChats() {
      let startTime = ''
      let endTime = ''
      if (this.timePick) {
        // startTime = dayjs(this.timePick[0]).format('YYYY-MM-DD HH:mm:ss')
        // endTime = dayjs(this.timePick[1]).format('YYYY-MM-DD HH:mm:ss')
        startTime = ~~(new Date(this.timePick[0]).getTime() / 1000)
        endTime = ~~(new Date(this.timePick[1]).getTime() / 1000)
      }
      console.log(this.wechat2query)
      queryChatHistory(this.wechat2query,
        this.friendId,
        this.chatKey,
        this.pageNo,
        this.pageSize,
        startTime,
        endTime
      ).then((res) => {
        console.log(res)
        this.resChats = res.data.rows || []
        this.totalChats = res.data.records || 0
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
