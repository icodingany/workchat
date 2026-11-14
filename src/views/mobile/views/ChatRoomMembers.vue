<template>
  <div class="chatroom-members">
    <div class="members-header">
      <button class="back-btn" @click="goBack">‹ 返回</button>
      <span class="members-title">群成员列表</span>
      <span class="placeholder"></span>
    </div>

    <div class="members-content">
      <div v-if="!members.length" class="empty-state">暂无群成员数据</div>
      <div
        v-for="(member, index) in members"
        :key="member.RemoteId || index"
        class="member-item"
        @click="selectMember(member)"
      >
        <el-avatar class="member-avatar" :size="44" :src="member.Avatar">
          {{ (member.Name || member.NickName || member.RemoteId || '?').charAt(0).toUpperCase() }}
        </el-avatar>
        <div class="member-info">
          <span class="member-name">{{ member.Name || member.NickName || member.ShowName || member.RemoteId }}</span>
          <span class="member-inviter" v-if="member.InviterUserName">由 {{ member.InviterUserName }} 邀请</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
  name: 'ChatRoomMembers',
  data() {
    return {
      members: []
    }
  },
  computed: {
    ...mapGetters('conversation', {
      currentFriend: 'currentFriend',
      currentWeChatId: 'currentWeChatId'
    })
  },
  mounted() {
    // 从 currentFriend 中获取群成员列表
    const friend = this.currentFriend
    if (friend && friend.Members) {
      this.members = Array.isArray(friend.Members) ? friend.Members : []
    } else if (friend && friend.members) {
      this.members = Array.isArray(friend.members) ? friend.members : []
    }
  },
  methods: {
    goBack() {
      this.$router.back()
    },
    selectMember(member) {
      // SET_CURRENT_FRIENDS 需要 { wxid, contact } 结构
      this.$store.commit('conversation/SET_CURRENT_FRIENDS', {
        wxid: this.currentWeChatId,
        contact: { ...member, RemoteId: member.RemoteId || member.UserName }
      })
      this.$router.push({ path: '/chat', query: { convId: member.RemoteId || member.UserName } })
    }
  }
}
</script>

<style lang="scss" scoped>
.chatroom-members {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;

  .members-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #fff;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;

    .back-btn {
      background: none;
      border: none;
      font-size: 16px;
      color: #333;
      cursor: pointer;
      padding: 4px 8px;
    }

    .members-title {
      font-size: 17px;
      font-weight: 600;
    }

    .placeholder {
      width: 50px;
    }
  }

  .members-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;
      font-size: 14px;
    }

    .member-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: #fff;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &:active {
        background: #f7f8fa;
      }

      .member-avatar {
        background: linear-gradient(135deg, #409eff, #337ecc);
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .member-info {
        flex: 1;
        margin-left: 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;

        .member-name {
          font-size: 15px;
          color: #333;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .member-inviter {
          font-size: 12px;
          color: #999;
        }
      }
    }
  }
}
</style>