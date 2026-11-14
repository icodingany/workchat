<template>
  <div class="take-labels">
    <div class="toolbar">
      <span>当前企微：</span>
      <el-select v-model="wxId" size="small" filterable placeholder="选择企微号" style="width: 220px" @change="onWxChange">
        <el-option
          v-for="w in wechats"
          :key="w.WxId"
          :label="w.Name || w.WxId"
          :value="w.WxId"
          :disabled="!w.IsOnline"
        />
      </el-select>
      <el-select v-model="labelId" size="small" filterable placeholder="选择要打的标签" style="width: 200px; margin-left: 10px">
        <el-option v-for="l in personalLabels" :key="l.Id" :label="l.Name" :value="l.Id" />
      </el-select>
      <el-button size="small" style="margin-left: 10px" @click="refreshLabels">刷新标签</el-button>
      <el-button size="small" style="margin-left: 8px" @click="refreshCustomers">同步客户</el-button>
      <el-button size="small" type="primary" style="margin-left: 8px" :disabled="!canApply" @click="applyLabels">
        批量打标 ({{ selectedRows.length }})
      </el-button>
    </div>

    <el-input
      v-model="keyword"
      size="small"
      clearable
      placeholder="搜索昵称/备注"
      style="width: 260px; margin: 8px 0"
    />

    <el-table
      ref="table"
      :data="filteredCustomers"
      height="100%"
      stripe
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column label="头像" width="60">
        <template #default="{ row }">
          <img v-if="row.Avatar" :src="row.Avatar" class="avatar" />
        </template>
      </el-table-column>
      <el-table-column label="昵称" prop="Name" min-width="120" />
      <el-table-column label="备注" prop="Remark" min-width="120" />
      <el-table-column label="已有标签" min-width="180">
        <template #default="{ row }">
          <el-tag
            v-for="name in labelNameList(row)"
            :key="name"
            size="small"
            type="warning"
            style="margin: 2px"
          >
            {{ name }}
          </el-tag>
          <span v-if="!labelNameList(row).length" style="color: #909399">无</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { TriggerUserLabelTask, TriggerCustomerPushTask, UserLabelSetTask } from '@/api/webSocketApi'

export default {
  name: 'TakeLabels',
  data() {
    return {
      wxId: '',
      labelId: null,
      keyword: '',
      selectedRows: []
    }
  },
  computed: {
    ...mapGetters({
      wechats: 'conversation/wechats',
      currentWeChatId: 'conversation/currentWeChatId',
      currentCustomers: 'conversation/currentCustomers',
      currentLabels: 'conversation/currentLabels'
    }),
    personalLabels() {
      const list = []
      ;(this.currentLabels || []).forEach((g) => {
        if (g.Type === 2 && g.Labels) {
          g.Labels.forEach((l) => list.push(l))
        }
      })
      return list
    },
    labelIdNameMap() {
      const map = {}
      this.personalLabels.forEach((l) => {
        map[l.Id] = l.Name
      })
      return map
    },
    filteredCustomers() {
      const kw = (this.keyword || '').trim().toLowerCase()
      const list = this.currentCustomers || []
      if (!kw) return list
      return list.filter((c) => {
        const name = (c.Name || '').toLowerCase()
        const remark = (c.Remark || '').toLowerCase()
        return name.includes(kw) || remark.includes(kw)
      })
    },
    canApply() {
      return this.wxId && this.labelId && this.selectedRows.length > 0
    }
  },
  watch: {
    currentWeChatId: {
      immediate: true,
      handler(id) {
        if (id && !this.wxId) {
          this.wxId = id
          this.onWxChange(id)
        }
      }
    }
  },
  methods: {
    onWxChange(id) {
      if (!id) return
      const wechat = (this.wechats || []).find((w) => w.WxId === id)
      if (wechat) this.$store.commit('conversation/SET_CURRENT_WECHAT', wechat)
      this.$store.dispatch('conversation/SetCurrentCustomers', id)
      TriggerUserLabelTask(id)
      this.selectedRows = []
      this.labelId = null
    },
    refreshLabels() {
      if (!this.wxId) return
      TriggerUserLabelTask(this.wxId)
    },
    refreshCustomers() {
      if (!this.wxId) return
      TriggerCustomerPushTask(this.wxId)
      this.$message.info('已触发客户同步，请稍候')
    },
    onSelectionChange(rows) {
      this.selectedRows = rows || []
    },
    labelNameList(row) {
      const ids = row.LabelIds || []
      return ids.map((id) => this.labelIdNameMap[id] || this.labelIdNameMap[String(id)]).filter(Boolean)
    },
    labelNamesOf(row) {
      return this.labelNameList(row).join('、')
    },
    applyLabels() {
      const addUsers = this.selectedRows.map((r) => r.RemoteId).filter(Boolean)
      if (!addUsers.length) {
        this.$message.warning('请选择客户')
        return
      }
      UserLabelSetTask({
        WxId: this.wxId,
        LabelId: this.labelId,
        IsCorp: false,
        AddUsers: addUsers
      })
      this.$message.success(`已下发打标任务：${addUsers.length} 人`)
    }
  }
}
</script>

<style lang="scss" scoped>
.take-labels {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 10px;
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px 0;
  font-size: 13px;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
}
</style>
