<template>
  <div class="friends-list">
    <van-search v-model="searchInfo" placeholder="搜索联系人" shape="round" clearable />
    <div class="source-tabs">
      <button
        class="source-tab"
        :class="{ active: source === 'customers' }"
        type="button"
        @click="source = 'customers'"
      >我的客户</button>
      <button
        class="source-tab"
        :class="{ active: source === 'staff' }"
        type="button"
        @click="source = 'staff'"
      >企业通讯录</button>
    </div>
    <div v-if="!friends.length" class="empty-state">暂无联系人</div>
    <div
      v-for="friend in friends"
      :key="friend.RemoteId"
      class="friend-item"
      @click="selectFriend(friend)"
    >
      <el-avatar class="friend-avatar" :size="44" :src="friend.Avatar">
        {{ (friend.Alias || friend.Name || friend.RemoteId || '?').charAt(0).toUpperCase() }}
      </el-avatar>
      <div class="friend-info">
        <span class="friend-name">{{ friend.Alias || friend.Name || friend.NickName || friend.RemoteId }}</span>
        <span class="friend-remark" v-if="friend.Remark">{{ friend.Remark }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
  name: 'MobileFriendsList',
  data() {
    return {
      source: 'customers',
      searchInfo: ''
    }
  },
  computed: {
    ...mapState('conversation', {
      currentCustomers: 'currentCustomers',
      currentContacts: 'currentContacts'
    }),
    ...mapGetters('conversation', {
      currentWeChatId: 'currentWeChatId'
    }),
    friends() {
      // PC 端为两个独立 tab：CustomerList（我的客户）/ StaffList（企业通讯录）
      const list = this.source === 'customers' ? this.currentCustomers : this.currentContacts
      const kw = (this.searchInfo || '').trim()
      if (!kw) return list || []
      return (list || []).filter((f) => {
        const name = f.Alias || f.Name || f.NickName || f.Remark || ''
        return name.indexOf(kw) >= 0
      })
    }
  },
  methods: {
    selectFriend(friend) {
      if (this.$parent && typeof this.$parent.choseFriend === 'function') {
        this.$parent.choseFriend({ ...friend, WeChatId: this.currentWeChatId })
        return
      }
      this.$store.commit('conversation/SET_CURRENT_FRIENDS', {
        wxid: this.currentWeChatId,
        contact: { ...friend }
      })
      this.$router.push({ path: '/chat', query: { convId: friend.RemoteId, wxId: this.currentWeChatId } })
    }
  }
}
</script>

<style lang="scss" scoped>
.friends-list {
  .source-tabs {
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
    display: flex;

    .source-tab {
      background: transparent;
      border: 0;
      color: #646566;
      flex: 1;
      font-size: 14px;
      padding: 10px 8px;
      -webkit-tap-highlight-color: transparent;

      &.active {
        color: #07c160;
        font-weight: 600;
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #999;
    font-size: 14px;
  }

  .friend-item {
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

    .friend-avatar {
      flex-shrink: 0;
      background: linear-gradient(135deg, #409eff, #337ecc);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }

    .friend-info {
      flex: 1;
      margin-left: 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;

      .friend-name {
        font-size: 15px;
        color: #333;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .friend-remark {
        font-size: 12px;
        color: #999;
      }
    }
  }
}
</style>
