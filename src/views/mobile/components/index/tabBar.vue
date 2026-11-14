<template>
  <div class="tab-bar">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: currentTab === tab.key }"
      @click="$emit('change', tab.key)"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MobileTabBar',
  props: {
    currentTab: { type: String, default: 'convs' }
  },
  emits: ['change'],
  data() {
    return {
      tabs: [
        { key: 'convs', label: '会话', icon: '💬' },
        { key: 'friends', label: '通讯录', icon: '👥' },
        { key: 'rooms', label: '群聊', icon: '👪' }
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
.tab-bar {
  display: flex;
  background: #fff;
  border-top: 1px solid #eee;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0 4px;
    color: #999;
    transition: color 0.2s;
    -webkit-tap-highlight-color: transparent;

    &.active {
      color: #07c160;
    }

    .tab-icon {
      font-size: 22px;
      line-height: 1.2;
    }

    .tab-label {
      font-size: 11px;
      margin-top: 2px;
    }
  }
}
</style>