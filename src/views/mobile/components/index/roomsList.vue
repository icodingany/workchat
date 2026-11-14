<template>
  <div class="rooms-list">
    <van-search v-model="searchInfo" placeholder="搜索群聊" shape="round" clearable />
    <div v-if="!rooms.length" class="empty-state">暂无群聊</div>
    <div
      v-for="room in rooms"
      :key="room.RemoteId || room.UserName"
      class="room-item"
      @click="selectRoom(room)"
    >
      <el-avatar class="room-avatar-el" :size="44" :src="room.Avatar">
        👥
      </el-avatar>
      <div class="room-info">
        <span class="room-name">{{ room.Alias || room.Name || room.ShowName || room.NickName || room.RemoteId }}</span>
        <span class="room-member-count" v-if="room.Members && room.Members.length">{{ room.Members.length }} 人</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MobileRoomsList',
  data() {
    return {
      searchInfo: ''
    }
  },
  computed: {
    ...mapGetters('conversation', {
      currentConvs: 'currentConvs',
      currentWeChatId: 'currentWeChatId'
    }),
    rooms() {
      // 群聊：会话带 Members（对齐 PC 群会话结构）
      let list = (this.currentConvs || []).filter((c) => c.Members && c.Members.length)
      const kw = (this.searchInfo || '').trim()
      if (!kw) return list
      return list.filter((r) => {
        const name = r.Alias || r.Name || r.ShowName || r.NickName || ''
        return name.indexOf(kw) >= 0
      })
    }
  },
  methods: {
    selectRoom(room) {
      const payload = {
        ...room,
        RemoteId: room.RemoteId || room.UserName,
        WeChatId: room.WeChatId || room.WxId || this.currentWeChatId
      }
      if (this.$parent && typeof this.$parent.choseFriend === 'function') {
        this.$parent.choseFriend(payload)
        return
      }
      this.$store.commit('conversation/SET_CURRENT_FRIENDS', {
        wxid: payload.WeChatId,
        contact: payload
      })
      this.$router.push({ path: '/chat', query: { convId: payload.RemoteId, wxId: payload.WeChatId } })
    }
  }
}
</script>

<style lang="scss" scoped>
.rooms-list {
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #999;
    font-size: 14px;
  }

  .room-item {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
      background: #f7f8fa;
    }

    .room-avatar-el {
      flex-shrink: 0;
      background: linear-gradient(135deg, #ffb800, #ff9800);
      color: #fff;
      font-size: 18px;
    }

    .room-info {
      flex: 1;
      margin-left: 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;

      .room-name {
        font-size: 15px;
        color: #333;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .room-member-count {
        font-size: 12px;
        color: #999;
      }
    }
  }
}
</style>
