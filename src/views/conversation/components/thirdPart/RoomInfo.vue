<template>
  <div class="room-info scroll">
    <!-- remoteid -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">群id</span>
      </div>
      <div class="friend-item-content">{{ currentFriend.Id || '' }}</div>
    </div>

    <!-- 群名称 -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">群聊名称</span>
        <div v-if="currentFriend.Members" class="btns">
          <el-button type="primary" plain icon="el-icon-edit-outline" circle @click="changeRoomName"></el-button>
        </div>
      </div>
      <div class="friend-item-content">{{ currentFriend.Name || '' }}</div>
    </div>

    <!-- 群公告 -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">群公告</span>
        <div class="btns">
          <el-button
            v-if="currentWeChatId === currentFriend.Creator"
            type="primary"
            plain
            icon="el-icon-edit-outline"
            circle
            @click="changeNotice"
          ></el-button>
        </div>
      </div>
      <div class="friend-item-content">{{ currentFriend.Notice || '' }}</div>
    </div>

    <!-- 群主 -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">群主</span>
        <div class="btns">
          <el-button
            v-if="currentWeChatId === currentFriend.Creator"
            type="primary"
            plain
            icon="el-icon-s-promotion"
            circle
            @click="transferOwner"
          ></el-button>
        </div>
      </div>
      <div class="friend-item-content owner">
        <!-- 群主头像 -->
        <el-avatar
          class="avatar"
          shape="square"
          :size="40"
          style="min-width: 40px"
          :src="roomAuthor.Avatar"
          @click="showMemberDetail(roomAuthor)"
        >
          <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png" />
        </el-avatar>
        <!-- 群主昵称 -->
        <div class="owner-name">
          <span v-text="roomAuthor.Name"></span>
        </div>
      </div>
    </div>

    <!-- 群成员 -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">
          群成员
          <span v-text="currentFriend.Members.length + '个人'"></span>
        </span>
        <div class="btns">
          <el-button type="primary" plain icon="el-icon-plus" circle @click="addMember"></el-button>
          <el-button type="danger" plain icon="el-icon-minus" circle @click="kickMember"></el-button>
          <el-button type="primary" plain icon="el-icon-view" circle @click="viewAllMember"></el-button>
        </div>
      </div>
      <div class="friend-item-content avatars">
        <el-avatar
          v-for="(member, index) in currentFriend.Members"
          :key="index"
          class="avatar"
          :class="{
            'is-contact': memberContactStatus(member.RemoteId) === 'contact',
            'is-external': memberContactStatus(member.RemoteId) === 'external',
            'is-stranger': memberContactStatus(member.RemoteId) === 'stranger'
          }"
          shape="square"
          :size="40"
          :src="member.Avatar"
          :title="member.Name + (memberContactStatus(member.RemoteId) === 'contact' ? '' : ' (' + (memberContactStatus(member.RemoteId) === 'external' ? '外部联系人' : '陌生人') + ')')"
          @click="showMemberDetail(member)"
          v-show="index < maxNumber"
        >
          <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png" />
        </el-avatar>
      </div>
      <div class="friend-item-footer">
        <el-button type="primary" class="footer-btn" @click="showAllMember">查看全部群成员</el-button>
      </div>
    </div>

    <!-- 一下等有空了再实现 -->

    <!-- 免打扰 -->
    <!-- <div class="dis-turb">
          <span class="tip">消息免打扰</span>
          {{currentFriend.MsgSilent}}
    </div>-->
    <!-- 保存到通讯录 -->
    <!-- <div class="dis-turb">
      <span class="tip">保存到通讯录</span>
    </div>-->
    <!-- 设置群邀请确认 -->
    <!-- <div class="dis-turb" v-if="w">
          <span class="tip">设置群邀请确认</span>
    </div>-->
    <!-- 设置群备注 微信7.0.14才有的功能 -->
    <!-- <div class="dis-turb" v-if="w">
          <span class="tip">设置群邀请确认</span>
    </div>-->
    <!-- 设置群管理员AddManager -->
    <!-- <div class="dis-turb" v-if="w">
          <span class="tip">设置群邀请确认</span>
    </div>-->

    <!-- 删除并退出 -->
    <el-button type="danger" style="margin: 15px 0" @click="deleteAndLogout">删除并退出</el-button>

    <SlotFriends
      v-if="friendsDialogVisible"
      :dialogTilte="dialogTilte"
      :action="action"
      :dialogData="dialogData"
      :currentFriend="currentFriend"
      :friends="dialogData"
      :friendsDialogVisible="friendsDialogVisible"
      @closeSlotFriends="friendsDialogVisible = false"
    ></SlotFriends>

    <!-- 群成员详情 -->
    <el-dialog class="member-detail" :modal="false" title="群成员详情" v-model="memberDialog">
      <div class="member-detail-info">
        <el-avatar shape="square" :size="100" :src="memberDetail.Avatar">
          <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png" />
        </el-avatar>
        <div class="member-detail-text">
          <p>
            微信：
            <span v-text="memberDetail.RemoteId"></span>
          </p>
          <p>
            昵称：
            <span v-text="memberDetail.Name || '- -'"></span>
          </p>
          <p>
            性别：
            <span v-text="memberDetail.Gender || '- -'"></span>
          </p>
        </div>
      </div>
      <div class="member-detail-btns">
        <el-button v-if="!contactsMap[memberDetail.FriendId]" type="primary" @click="getMemberDetail">
          获取详情
        </el-button>
        <el-button v-if="!contactsMap[memberDetail.FriendId]" type="primary" @click="addToAddress">
          添加到通讯录
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { throttle } from 'lodash'
import { chatRoomActionTask } from '@/api/webSocketApi'

import SlotFriends from '../SlotFriends'

export default {
  name: 'RoomInfo',
  data() {
    return {
      maxNumber: 30,
      memberDialog: false, // 显示群成员详情
      memberDetail: {}, // 群成员详情
      action: 0,
      dialogTilte: '添加群成员',
      dialogData: [],
      friendsDialogVisible: false,
      doNotTouch: 0, // 免打扰
      saveToAddress: 0, // 保存到通讯录
      setInvitationConfirm: 0 // 邀请确认
    }
  },
  components: {
    SlotFriends
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId',
      contactsMap: 'conversation/contactsMap',
      currentFriend: 'conversation/currentFriend',
      currentContacts: 'conversation/currentContacts',
      currentCustomers: 'conversation/currentCustomers',
      memberContactStatus: 'conversation/memberContactStatus'
    }),
    // 我的客户和企业联系人
    friends() {
      let friends = this.currentContacts.concat(this.currentCustomers)
      return friends.filter((x) => {
        return !this.membersMap[x.RemoteId]
      })
    },
    // 群成员map
    membersMap() {
      let mm = {}
      if (this.currentFriend.Members) {
        this.currentFriend.Members.forEach((x) => {
          mm[x.RemoteId] = x
        })
      }
      return mm
    },
    // 群主
    roomAuthor() {
      if (this.currentFriend.Creator) {
        return this.membersMap[this.currentFriend.Creator]
      }
      return {}
    }
  },
  methods: {
    // 改群名
    changeRoomName() {
      this.$prompt('修改群聊名称', '修改群聊名称', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: this.currentFriend.Name,
        inputPattern: /\S{1,50}/,
        inputErrorMessage: '备注长度1-50，不能含有特殊字符！'
      })
        .then(({ value }) => {
          chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 0, { Content: value })
        })
        .catch(() => {
          this.$message.info('取消输入')
        })
    },
    // 修改群公告
    changeNotice() {
      this.$prompt('修改群公告', '修改群公告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: this.currentFriend.Notice,
        inputPattern: /\S{1,500}/,
        inputErrorMessage: '备注长度1-500，不能含有特殊字符！'
      })
        .then(({ value }) => {
          console.log('修改群公告', value)
          chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 1, { Content: value })
        })
        .catch(() => {})
    },
    // 删除并退出群
    deleteAndLogout() {
      this.$message.info('待实现，敬请期待！')
      return
      //   this.$confirm('删除并退出群?', '提示', {
      //     confirmButtonText: '确定',
      //     cancelButtonText: '取消',
      //     type: 'warning'
      //   })
      //     .then(() => {
      //       chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 7, {})

      //     })
      //     .catch(() => {})
    },
    // 拉人进群
    addMember() {
      this.dialogTilte = '拉人进群'
      this.action = 2
      this.friendsDialogVisible = true
      this.dialogData = this.friends
    },
    // 踢出群
    kickMember() {
      if (this.currentFriend.Creator === this.currentWeChatId) {
        this.dialogData = this.currentFriend.Members
        this.dialogTilte = '踢人出群'
        this.action = 3
        this.friendsDialogVisible = true
      } else {
        this.$message.warning('你不是群主！')
      }
    },
    // 转让群主
    transferOwner() {
      this.$message.info('待实现，敬请期待！')
      return
      //   if (this.currentFriend.WeChatId === this.currentFriend.Owner) {
      //     let members = []
      //     for (const mid of this.currentFriend.Members) {
      //       let avatar = ''
      //       if (this.contactsMap[mid] && this.contactsMap[mid].Avatar) {
      //         avatar = this.contactsMap[mid].Avatar
      //       } else if (this.membersMap[mid] && this.membersMap[mid].Avatar) {
      //         avatar = this.membersMap[mid].Avatar
      //       }
      //       let friendNick = ''
      //       if (this.contactsMap[mid] && this.contactsMap[mid].FriendNick) {
      //         friendNick = this.contactsMap[mid].FriendNick
      //       } else if (this.membersMap[mid] && this.membersMap[mid].Nickname) {
      //         friendNick = this.membersMap[mid].Nickname
      //       }
      //       let friend = {
      //         WeChatId: this.currentFriend.WeChatId,
      //         FriendId: mid,
      //         Avatar: avatar,
      //         FriendNick: friendNick,
      //         LabelIds: this.contactsMap[mid] && this.contactsMap[mid].LabelIds ? this.contactsMap[mid].LabelIds : '',
      //       }
      //       members.push(friend)
      //     }
      //     this.dialogData = members
      //     this.dialogTilte = '群主转让'
      //     this.action = 10
      //     this.friendsDialogVisible = true
      //   } else {
      //     this.$message.warning('你不是群主！')
      //   }
    },
    // 显示或隐藏群成员
    showAllMember() {
      this.maxNumber === 30 ? (this.maxNumber = 500) : (this.maxNumber = 30)
    },
    // 查看群成员
    viewAllMember() {
      //   this.$message.info('待实现，敬请期待！')
      //   return
      chatRoomActionTask(this.currentWeChatId, this.currentFriend.RemoteId, 9, {})
    },
    // 成员详情
    showMemberDetail(member) {
      this.memberDetail = member
      this.memberDialog = true
    },
    // 添加到通讯录
    addToAddress() {
      this.$message.info('待实现，敬请期待！')
      return
      //   let content = {
      //     WeChatId: this.memberDetail.WeChatId, // 商家个人微信内部全局唯一识别码
      //     ChatroomId: this.currentFriend.UserName, // 所在的群聊id
      //     FriendId: this.memberDetail.FriendId, // 请求加好友微信内部全局唯一识别码
      //     Message: '', // 招呼语
      //     Remark: '', // 备注信息
      //   }
      //   this.$store.dispatch('websocket/AddFriendInChatRoomTask', content)

      //   this.memberDialog = false
      //   this.$message.info('指令已经下发！')
    },
    // 获取详情
    getMemberDetail() {
      this.$message.info('待实现，敬请期待！')
      return
      //   let content = {
      //     wechatId: this.memberDetail.WeChatId,
      //     friendId: this.memberDetail.FriendId
      //   }
      //   this.$store.dispatch('websocket/RequestContactsInfoTask', content)
      //   this.memberDialog = false
      //   this.$message.info('指令已经下发！')
    }
  },
  created() {
    this.viewAllMember = throttle(this.viewAllMember, 5000)
  }
}
</script>

<style lang="scss" scoped>
.room-info {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;

  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 5px;

  .el-button {
    padding: 2px;
  }

  .friend-item {
    width: 100%;
    margin: 5px 0;

    .friend-item-title {
      background: #b3d8ff;
      padding: 5px;
      display: flex;
      justify-content: space-between;
      .tip {
        line-height: 20px;
      }
      .btns {
        line-height: 20px;
      }
    }

    .friend-item-content {
      background: white;
      min-height: 30px;
      padding: 5px;
    }
    .owner {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      .owner-name {
        margin-left: 5px;
        @include ellipsis(3);
      }
    }
    .avatars {
      display: flex;
      flex-wrap: wrap;
      .avatar {
        width: 60px;
        margin: 2px;
      }
      .is-contact {
        border: solid green 2px;
      }
      .is-external {
        border: solid orange 2px;
      }
      .is-stranger {
        border: solid red 2px;
      }
    }

    .friend-item-footer {
      background: white;
      width: 100%;
      .footer-btn {
        // border: solid red 1px;
        width: 150px;
        margin: 5px 75px;
      }
    }
  }

  // Element Plus：class 挂在 .el-dialog 面板上
  .member-detail {
    display: flex;
    flex-direction: column;
    &.el-dialog,
    :deep(.el-dialog) {
      width: 500px;
      .el-dialog__body {
        padding: 20px;
      }
    }
    .member-detail-info {
      display: flex;
      .member-detail-text {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        margin-left: 20px;
        overflow: hidden;
      }
    }
    .member-detail-btns {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
    }
  }
}
</style>

