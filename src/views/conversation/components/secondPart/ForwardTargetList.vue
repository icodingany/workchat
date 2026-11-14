<template>
  <div class="forward-target-list">
    <div
      v-for="row in items"
      :key="rowKey(row)"
      class="forward-target-row"
      :class="{ 'is-on': isOn(row) }"
      @click="$emit('toggle', row)"
    >
      <div class="forward-target-hit">
        <span class="fwd-check" :class="{ 'is-on': isOn(row) }"></span>
      </div>
      <el-image class="forward-target-avatar" :src="row.Avatar" lazy>
        <template #error>
          <div class="image-slot">
            <i class="fa fa-user" style="font-size: 24px; color: #c0c4cc"></i>
          </div>
        </template>
      </el-image>
      <div class="forward-target-text">
        <div class="forward-target-title">{{ displayTitle(row) }}</div>
        <div v-if="displaySubtitle(row)" class="forward-target-sub">{{ displaySubtitle(row) }}</div>
      </div>
    </div>
    <div v-if="!items.length" class="forward-target-empty">暂无数据</div>
  </div>
</template>

<script>
import { getForwardTargetId } from '@/utils/forwardHelpers'

export default {
  name: 'ForwardTargetList',
  props: {
    items: { type: Array, default: () => [] },
    selected: { type: Array, default: () => [] },
    titleProp: { type: String, default: '' },
    subtitleProp: { type: String, default: '' }
  },
  emits: ['toggle'],
  methods: {
    rowKey(row) {
      return getForwardTargetId(row) || JSON.stringify(row)
    },
    isOn(row) {
      const id = getForwardTargetId(row)
      if (!id) return false
      return this.selected.some((item) => getForwardTargetId(item) === id)
    },
    displayTitle(row) {
      if (!row) return ''
      if (this.titleProp && row[this.titleProp]) return row[this.titleProp]
      return row.ShowName || row.Name || row.Alias || row.FriendNick || row.NickName || ''
    },
    displaySubtitle(row) {
      if (!row) return ''
      if (this.subtitleProp && row[this.subtitleProp]) return row[this.subtitleProp]
      return row.Memo || row.Digest || ''
    }
  }
}
</script>

<style lang="scss" scoped>
.forward-target-list {
  height: 360px;
  overflow: auto;
  margin: 0 -8px;
  padding: 0 8px;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
  }
}
.forward-target-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  margin: 0 -8px;
  border-radius: 6px;
  cursor: pointer;
  &:hover,
  &.is-on {
    background: #f5f7fa;
  }
}
.forward-target-hit {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.forward-target-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;
}
.forward-target-text {
  min-width: 0;
  flex: 1;
}
.forward-target-title {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.forward-target-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.forward-target-empty {
  padding: 40px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
</style>
