<template>
  <!-- 好友dialog -->
  <el-dialog
    append-to-body
    :title="dialogTilte"
    class="slot-friends"
    :model-value="friendsDialogVisible"
    :before-close="beforeCloseSlotFriendsDialog"
    @update:model-value="onDialogVisibleChange"
  >
    <div class="slot-friends-content">
      <!-- 好友列表 -->
      <div class="friends-list">
        <el-table ref="multipleTable" :data="tableData" stripe @selection-change="handleSelectionChange">
          <el-table-column label="昵称" prop="Name"></el-table-column>
          <el-table-column label="头像" width="60px" style="border: solid red 1px">
            <template #default="scope">
              <el-image style="width: 30px; height: 30px" :src="scope.row.Avatar">
                <template #error>
                  <div class="image-slot">
                    <i style="font-size: 30px" class="el-icon-picture-outline"></i>
                  </div>
                </template>
              </el-image>
            </template>
          </el-table-column>
          <el-table-column label="备注名" prop="Alias"></el-table-column>
          <el-table-column type="selection" width="55"></el-table-column>
        </el-table>
      </div>
    </div>

    <div class="tip">
      <p>*点击左侧好友标签一键选中当前页面该标签好友</p>
      <p>共{{ friends.length }}人,已选{{ finalFriends.length }}人</p>
    </div>

    <template #footer>
      <span>
        <el-button @click="beforeCloseSlotFriendsDialog">取 消</el-button>
        <el-button type="primary" @click="submit">确 定</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { mapGetters } from 'vuex'
import { chatRoomActionTask, TalkToFriendTask } from '@/api/webSocketApi'

export default {
  props: {
    currentFriend: {
      type: Object,
      required: true,
      default: function () {
        return {}
      }
    }, // 当前选中的好友
    friendsDialogVisible: {
      type: Boolean,
      required: true,
      default: false
    }, // 展示dialog
    dialogTilte: {
      type: String,
      required: true,
      default: '好友列表'
    }, // dialog的title
    action: {
      type: [String, Number],
      required: false,
      default: 0
    }, // dialog的作用 发名片|建群|...
    friends: {
      type: Array,
      default: function () {
        return []
      }
    } // 表的原始数据
  },
  data() {
    return {
      tableData: this.friends, // 表数据 默认展示全部的好友
      searchContent: '', // 搜索框的内容
      finalFriends: [] // 计算最终选中的好友
    }
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId'
    })
  },
  watch: {
    // 监听搜索栏
    searchContent(sc) {
      if (sc) {
        this.tableData = this.friends.filter((x) => {
          // 昵称
          if (x.FriendNick) {
            return x.FriendNick.indexOf(this.searchContent) >= 0
          }
          // 备注
          if (x.Memo) {
            return x.Memo.indexOf(this.searchContent) >= 0
          }
          // 群名
          if (x.NickName) {
            return x.NickName.indexOf(this.searchContent) >= 0
          }
          // 陌生人
          if (x.Nickname) {
            return x.Nickname.indexOf(this.searchContent) >= 0
          }
        })
      } else {
        this.tableData = this.friends
      }
    }
  },
  methods: {
    toggleSelection(rows) {
      if (rows) {
        rows.forEach((row) => {
          this.$refs.multipleTable.toggleRowSelection(row)
        })
      } else {
        this.$refs.multipleTable.clearSelection()
      }
    },
    handleSelectionChange(val) {
      this.finalFriends = val
    },
    // 关闭dialog。element-plus 的 before-close 会传 done 回调；按钮 @click 调用时无参。
    beforeCloseSlotFriendsDialog(done) {
      this.$emit('closeSlotFriends', true)
      if (typeof done === 'function') done()
    },
    // element-plus el-dialog 用 model-value + update:model-value；关闭时通知父组件
    onDialogVisibleChange(val) {
      if (!val) this.$emit('closeSlotFriends', true)
    },
    // 提交按钮
    submit() {
      // 至少选择一个群成员|好友
      const friendsNumber = this.finalFriends.length
      //   const membersNumber = this.currentFriend.Members ? this.currentFriend.Members.length : 0
      const id2send = this.finalFriends.map((x) => (x = x.RemoteId))

      if (friendsNumber === 0) {
        this.$alert('请选中好友！', '提示', { type: 'warning' })
        return
      }
      console.log(this.action)
      switch (this.action) {
        case 2:
          //   // 拉人进群，群人数不能超过500
          //   if (membersNumber + friendsNumber >= 500) {
          //     this.$message.warning('群人数不能超过500人！')
          //     return
          //   }
          chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 2, { Members: id2send, Content: '' })
          break
        case 3:
          // 踢人出群
          chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 3, { Members: id2send })
          break
        case 8:
          //   创建群聊 人数并不能大于500
          if (friendsNumber > 500) {
            this.$alert('群聊人数不能大于500！', '提示', { type: 'warning' })
            return
          }
          chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 8, { Members: id2send, Content: '' })

          break
        case 10:
          // 转让群主
          //   if (friendsNumber !== 1) {
          //     this.$alert('转让群主，只能选择一个群成员！', '提示', { type: 'warning' })
          //     return
          //   }
          //   msg.ChatRoomId = this.currentFriend.UserName
          //   msg.Action = this.action
          //   msg.Content = this.finalFriends.join(',')
          //   this.$store.dispatch('websocket/ChatRoomActionTask', msg)
          break
        case 'NameCard':
          // 发送名片 只能选择一个好友
          if (friendsNumber > 1) {
            this.$message.warning('发名片，只能选择一个好友员！')
            return
          }
          TalkToFriendTask(this.currentWeChatId, this.currentFriend.RemoteId, this.action, id2send[0])
          break
        case 'Forward':
          this.$emit('forwardConfirm', id2send)
          break
        case 'SendFriendCircle':
          //   this.$emit('handlerCheckedFriends', this.finalFriends)
          break
        default:
          break
      }
      //   if (this.action !== 'SendFriendCircle') {
      //     this.$message.info('任务已经下发!')
      //   }
      // 提交任务后关闭dialog
      this.beforeCloseSlotFriendsDialog()
    }
  }
}
</script>

<style lang="scss" scoped>
</style>

