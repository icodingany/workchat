<template>
  <div class="clear-fans">
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
      <el-button size="small" type="primary" style="margin-left: 10px" :disabled="!wxId" @click="syncCustomers">
        同步客户（检测单向）
      </el-button>
      <el-button
        size="small"
        type="warning"
        style="margin-left: 8px"
        :disabled="!oneWayList.length || applying"
        :loading="applying"
        @click="applyZombie"
      >
        补齐「僵尸粉」标签 ({{ oneWayList.length }})
      </el-button>
      <el-button size="small" style="margin-left: 8px" @click="clearList">清空列表</el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="点击「同步客户」后，手机端会扫描单向好友并上报；服务端会自动打「僵尸粉」标签。本页可查看最近上报列表，并手动补齐标签。"
      style="margin-bottom: 10px"
    />

    <p v-if="jobStatus" class="job-status">任务状态：{{ jobStatus }}</p>
    <el-progress
      v-if="jobTotal > 0"
      :percentage="jobPercent"
      :status="jobProgressStatus"
      style="margin-bottom: 10px"
    />

    <el-table :data="oneWayList" stripe height="100%">
      <el-table-column label="客户ID" prop="remoteId" width="160" />
      <el-table-column label="昵称" prop="name" min-width="140" />
      <el-table-column label="备注" prop="remark" min-width="120" />
      <el-table-column label="僵尸粉标签" width="150">
        <template #default="{ row }">
          <el-tag v-if="row.hasZombieLabel" type="success" size="small">已打上僵尸粉标签</el-tag>
          <span v-else style="color: #909399">未打标签</span>
        </template>
      </el-table-column>
      <el-table-column label="上报时间" prop="time" width="180" />
    </el-table>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { TriggerCustomerPushTask, TriggerUserLabelTask } from '@/api/webSocketApi'
import { ensureZombieLabel, applyZombieLabel, getZombieLabelJob } from '@/api/httpApi'

export default {
  name: 'ClearFans',
  data() {
    return {
      wxId: '',
      applying: false,
      jobStatus: '',
      jobApplied: 0,
      jobTotal: 0,
      pollTimer: null
    }
  },
  computed: {
    ...mapGetters({
      wechats: 'conversation/wechats',
      currentWeChatId: 'conversation/currentWeChatId',
      currentCustomers: 'conversation/currentCustomers',
      currentLabels: 'conversation/currentLabels',
      recentOneWay: 'tools/recentOneWay'
    }),
    jobPercent() {
      if (!this.jobTotal) return 0
      return Math.min(100, Math.round((this.jobApplied / this.jobTotal) * 100))
    },
    jobProgressStatus() {
      if (this.jobStatus === 'SUCCESS') return 'success'
      if (this.jobStatus === 'FAILED') return 'exception'
      return undefined
    },
    zombieLabelId() {
      for (const g of this.currentLabels || []) {
        if (!g.Labels) continue
        const hit = g.Labels.find((l) => l.Name === '僵尸粉')
        if (hit) return hit.Id
      }
      return null
    },
    oneWayList() {
      const ids = (this.recentOneWay && this.recentOneWay[this.wxId]) || []
      const map = {}
      ;(this.currentCustomers || []).forEach((c) => {
        map[c.RemoteId] = c
        map[String(c.RemoteId)] = c
      })
      const zid = this.zombieLabelId
      return ids.map((id) => {
        const c = map[id] || map[String(id)] || {}
        const labelIds = c.LabelIds || []
        const hasZombieLabel =
          zid != null && labelIds.some((lid) => String(lid) === String(zid))
        return {
          remoteId: id,
          name: c.Name || '',
          remark: c.Remark || c.Alias || '',
          time: c.oneWayTime || '',
          hasZombieLabel
        }
      })
    }
  },
  watch: {
    currentWeChatId: {
      immediate: true,
      handler(id) {
        if (id && !this.wxId) this.wxId = id
      }
    }
  },
  beforeUnmount() {
    this.stopPoll()
  },
  methods: {
    onWxChange(id) {
      if (!id) return
      const wechat = (this.wechats || []).find((w) => w.WxId === id)
      if (wechat) this.$store.commit('conversation/SET_CURRENT_WECHAT', wechat)
      this.$store.dispatch('conversation/SetCurrentCustomers', id)
      this.jobStatus = ''
      this.jobApplied = 0
      this.jobTotal = 0
    },
    syncCustomers() {
      if (!this.wxId) return
      TriggerCustomerPushTask(this.wxId)
      TriggerUserLabelTask(this.wxId)
      this.$message.info('已触发客户同步，等待单向好友上报…')
    },
    clearList() {
      this.$store.commit('tools/CLEAR_RECENT_ONE_WAY', this.wxId)
    },
    /**
     * 自动打标由后端 OneWayCustomerPushNoticeHandler 负责，避免前后端双发。
     */
    autoMarkZombieLabelIfNeeded() {},
    applyZombie() {
      const friendIds = this.oneWayList.map((x) => x.remoteId).filter(Boolean)
      if (!friendIds.length) return
      this.applying = true
      this.jobStatus = 'ENSURE…'
      this.jobApplied = 0
      this.jobTotal = friendIds.length
      ensureZombieLabel(this.wxId)
        .then((res) => {
          if (res.code !== 0) throw new Error(res.msg || 'ensure 失败')
          return applyZombieLabel(this.wxId, friendIds.join(','))
        })
        .then((res) => {
          if (res.code !== 0) throw new Error(res.msg || 'apply 失败')
          const job = res.data || {}
          this.jobStatus = job.status || 'DISPATCHING'
          this.jobTotal = job.total || this.jobTotal
          this.jobApplied = job.appliedCount || 0
          if (job.jobId) this.pollJob(job.jobId)
          else this.applying = false
        })
        .catch((e) => {
          this.applying = false
          this.jobStatus = ''
          this.jobTotal = 0
          this.$message.error(e.message || '补齐失败')
        })
    },
    pollJob(jobId) {
      this.stopPoll()
      let n = 0
      this.pollTimer = setInterval(() => {
        n += 1
        getZombieLabelJob(jobId).then((res) => {
          if (res.code !== 0 || !res.data) return
          const job = res.data
          const st = job.status || ''
          this.jobStatus = st
          this.jobTotal = job.total || this.jobTotal
          this.jobApplied = job.appliedCount || 0
          if (['SUCCESS', 'PARTIAL', 'FAILED'].includes(st) || n > 60) {
            this.stopPoll()
            this.applying = false
            if (st === 'SUCCESS') this.$message.success('打标完成')
            else if (st === 'PARTIAL') this.$message.warning('部分成功')
            else if (st === 'FAILED') this.$message.error(job.errorMsg || '打标失败')
          }
        })
      }, 1000)
    },
    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.clear-fans {
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
.job-status {
  font-size: 13px;
  color: #666;
  margin: 0 0 8px;
}
</style>
