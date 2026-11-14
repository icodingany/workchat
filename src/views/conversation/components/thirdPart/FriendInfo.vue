<template>
  <div class="label-remark">
    <!-- RemoteId -->
    <div class="friend-item">
      <div class="friend-item-title">RemoteId</div>
      <div class="friend-item-content">{{ currentContact.RemoteId || '' }}</div>
    </div>
    <!-- UnionId -->
    <div v-show="currentContact.UnionId" class="friend-item">
      <div class="friend-item-title">UnionId</div>
      <div class="friend-item-content">{{ currentContact.UnionId }}</div>
    </div>
    <!-- Name -->
    <div class="friend-item">
      <div class="friend-item-title">昵称</div>
      <div class="friend-item-content">
        {{ currentContact.Name }}
        <span v-show="currentContact.Suffix" style="color: #67c23a">@{{ currentContact.Suffix }}</span>
      </div>
    </div>
    <!-- 备注 -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">备注名</span>
        <div v-if="isCustomer" class="btns">
          <el-button
            style="padding: 2px"
            type="primary"
            plain
            icon="el-icon-edit-outline"
            circle
            title="修改备注"
            @click="modifyMemo"
          ></el-button>
          <el-button
            style="padding: 2px"
            type="danger"
            plain
            icon="el-icon-delete"
            circle
            title="删除备注"
            @click="deleteMemo"
          ></el-button>
        </div>
      </div>
      <div class="friend-item-content">{{ currentContact.Alias || '' }}</div>
    </div>
    <!-- 描述 | 没用接口中不再提供此信息 -->
    <!-- <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">描述</span>
        <div class="btns">
          <el-button type="primary" plain icon="el-icon-edit-outline" circle @click="modifyDesc"></el-button>
          <el-button type="danger" plain icon="el-icon-delete" circle @click="deleteDesc"></el-button>
        </div>
      </div>
      <div class="friend-item-content">{{currentContact.Desc || ''}}</div>
    </div>-->
    <!-- 电话 -->
    <div class="friend-item">
      <div class="friend-item-title">
        <span class="tip">电话</span>
        <!-- <div class="btns">
          <el-button type="primary" plain icon="el-icon-plus" circle @click="addPhone"></el-button>
          <el-button
            type="danger"
            plain
            icon="el-icon-delete"
            circle
            @click="deleteAllPhone"
            title="清空号码"
          ></el-button>
        </div>-->
      </div>
      <div class="friend-item-content">
        <div class="phone-item" v-for="(phone, index) in phones" :key="index">
          <span v-text="phone"></span>
          <!-- <el-button
            class="delete-one-phone"
            type="primary"
            plain
            icon="el-icon-close"
            circle
            @click="deleteOnePhone(index)"
          ></el-button>-->
        </div>
      </div>
    </div>

    <!-- 企业联系人 -->
    <template v-if="currentContact.hasOwnProperty('DepartIds')">
      <!-- 职位 -->
      <div class="friend-item">
        <div class="friend-item-title">职位</div>
        <div class="friend-item-content">{{ currentContact.Job || '无' }}</div>
      </div>
      <!-- 部门 -->
      <div v-show="currentContact.DepartIds" class="friend-item">
        <div class="friend-item-title">
          <span class="tip">部门</span>
        </div>
        <div class="friend-item-content">
          <el-tag v-for="(departId, index) in currentContact.DepartIds" :key="index" type>
            {{ (departments[currentWeChatId] && departments[currentWeChatId][departId]) || departId }}
          </el-tag>
        </div>
      </div>
    </template>

    <!-- 我的客户 -->
    <template v-else>
      <!-- 来源 -->
      <div class="friend-item">
        <div class="friend-item-title">
          <span class="tip">来源</span>
        </div>
        <div class="friend-item-content">
          {{ $filters.getFriendSource(currentContact.Source) }}
        </div>
      </div>
      <!-- 添加时间 -->
      <div class="friend-item">
        <div class="friend-item-title">添加时间</div>
        <div class="friend-item-content">
          {{ $filters.timeFilter(currentContact.AddTime) }}
        </div>
      </div>
      <!-- 标签：全部可选标签直接铺在面板上，已打上的高亮；点击切换 -->
      <div class="friend-item friend-item-labels">
        <div class="friend-item-title">
          <span class="tip">客户标签</span>
          <div class="btns">
            <el-button
              style="padding: 2px"
              type="primary"
              plain
              icon="el-icon-plus"
              circle
              title="新建标签"
              @click="openSelectLabelDialog"
            ></el-button>
          </div>
        </div>
        <div class="friend-item-content label-panel">
          <div v-if="!labelPanelGroups.length" class="label-empty">暂无标签，点 + 新建</div>
          <div v-for="(lg, index) in labelPanelGroups" :key="'lg-' + index" class="label-group">
            <p class="label-group-title">{{ lg.title }}</p>
            <ul class="label-chip-list">
              <li
                v-for="(label, li) in lg.labels"
                :key="'chip-' + index + '-' + li"
                class="label-class"
                :class="{ chose: hasLabel(label.Id) }"
                :title="hasLabel(label.Id) ? '点击移除' : '点击打上'"
                @click="togglePanelLabel(label, lg.isCorp)"
              >
                {{ label.Name }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <!-- 仅新建标签（选已有也可用，但主路径已在面板点选） -->
    <el-dialog
      title="新建标签"
      v-model="selectDialogVisible"
      width="360px"
      append-to-body
      :modal="false"
      @open="selectValue = null"
    >
      <el-select
        v-model="selectValue"
        filterable
        allow-create
        default-first-option
        placeholder="输入新标签名，或选择已有标签"
        style="width: 100%"
      >
        <el-option-group label="个人标签">
          <el-option
            v-for="label in personalLabelOptions"
            :key="'sel-' + label.Id"
            :label="label.Name"
            :value="label.Id"
          />
        </el-option-group>
      </el-select>
      <template #footer>
        <span>
          <el-button size="small" @click="selectDialogVisible = false">取 消</el-button>
          <el-button size="small" type="primary" :disabled="selectValue == null || selectValue === ''" @click="confirmSelectLabel">
            确 定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { UserLabelSetTask, UserLabelModifyTask, SetUserMemoTask, TriggerUserLabelTask } from '@/api/webSocketApi'

export default {
  name: 'FriendInfo',
  data() {
    return {
      selectDialogVisible: false,
      selectValue: null,
      pendingNewLabelName: ''
    }
  },
  computed: {
    ...mapGetters({
      departments: 'conversation/departments',
      currentContact: 'conversation/currentFriend',
      currentLabels: 'conversation/currentLabels',
      currentCustomers: 'conversation/currentCustomers',
      currentWeChatId: 'conversation/currentWeChatId'
    }),
    isCustomer() {
      return !!(this.currentContact && this.currentContact.RemoteId && !Object.prototype.hasOwnProperty.call(this.currentContact, 'DepartIds'))
    },
    labelIds() {
      const fromFriend = this.currentContact.LabelIds
      if (Array.isArray(fromFriend) && fromFriend.length) return fromFriend
      const rid = this.currentContact.RemoteId
      if (rid == null) return []
      const cust = (this.currentCustomers || []).find((c) => String(c.RemoteId) === String(rid))
      return (cust && cust.LabelIds) || fromFriend || []
    },
    myLabels() {
      const ml = []
      for (const lg of this.currentLabels) {
        if (lg.Type === 2 && lg.Labels) {
          for (const label of lg.Labels) ml.push(label.Id)
        }
      }
      return ml
    },
    personalLabelNames() {
      const names = []
      for (const lg of this.currentLabels) {
        if (lg.Type === 2 && lg.Labels) {
          for (const label of lg.Labels) names.push(label.Name)
        }
      }
      return names
    },
    personalLabelOptions() {
      const list = []
      for (const lg of this.currentLabels || []) {
        if (lg.Type === 2 && lg.Labels) {
          for (const label of lg.Labels) list.push(label)
        }
      }
      return list
    },
    /** 面板上直接展示的标签分组 */
    labelPanelGroups() {
      const groups = []
      for (const lg of this.currentLabels || []) {
        if (!lg.Labels || !lg.Labels.length) continue
        const isCorp = lg.Type === 1
        groups.push({
          title: isCorp ? '企业标签' + (lg.Name ? ' · ' + lg.Name : '') : '个人标签' + (lg.Name ? ' · ' + lg.Name : ''),
          isCorp,
          labels: lg.Labels
        })
      }
      return groups
    },
    labelMap() {
      const lm = {}
      const mln = []
      if (this.currentLabels.length > 0) {
        for (const lg of this.currentLabels) {
          if (lg.Type === 2 && lg.Labels) {
            for (const label of lg.Labels) {
              lm[label.Id] = label.Name
              lm[String(label.Id)] = label.Name
              mln.push(label.Name)
            }
          }
        }
        for (const lg of this.currentLabels) {
          if (lg.Type === 1 && lg.Labels) {
            for (const label of lg.Labels) {
              const name = mln.indexOf(label.Name) >= 0 ? lg.Name + ':' + label.Name : label.Name
              lm[label.Id] = name
              lm[String(label.Id)] = name
            }
          }
        }
      }
      return lm
    },
    phones() {
      if (this.currentContact.Mobile) return this.currentContact.Mobile.split(',')
      return []
    }
  },
  watch: {
    currentLabels: {
      deep: true,
      handler() {
        this.tryApplyPendingNewLabel()
      }
    },
    isCustomer: {
      immediate: true,
      handler(v) {
        if (v) this.ensureLabelsLoaded()
      }
    },
    currentWeChatId() {
      if (this.isCustomer) this.ensureLabelsLoaded()
    }
  },
  methods: {
    hasLabel(labelId) {
      const id = String(labelId)
      return (this.labelIds || []).some((x) => String(x) === id)
    },
    patchFriendLabels(nextIds) {
      this.$store.dispatch('conversation/PatchCustomerLabelIds', {
        wxId: this.currentWeChatId,
        remoteId: this.currentContact.RemoteId,
        labelIds: nextIds
      })
    },
    toIdStr(v) {
      if (v == null || v === '') return ''
      return String(v)
    },
    ensureLabelsLoaded() {
      if (!this.currentWeChatId) return
      if (!this.currentLabels || !this.currentLabels.length) {
        TriggerUserLabelTask(this.currentWeChatId)
      }
    },
    togglePanelLabel(label, isCorp) {
      if (!this.currentContact.RemoteId) {
        this.$message.warning('请先选择好友')
        return
      }
      if (this.hasLabel(label.Id)) {
        this.removeLabel(label.Id, true)
      } else {
        this.applyLabelToFriend(label.Id, !!isCorp)
      }
    },
    openSelectLabelDialog() {
      if (!this.isCustomer) {
        this.$message.warning('请先选择客户好友')
        return
      }
      this.ensureLabelsLoaded()
      this.selectValue = null
      this.selectDialogVisible = true
    },
    confirmSelectLabel() {
      const v = this.selectValue
      if (v == null || v === '') return
      if (typeof v === 'number' || (/^\d+$/.test(String(v)) && this.labelMap[v] != null)) {
        const id = typeof v === 'number' ? v : Number(v)
        if (this.hasLabel(id)) {
          this.$message.warning('该标签已经存在')
          return
        }
        this.applyLabelToFriend(id, !this.myLabels.some((x) => String(x) === String(id)))
        this.selectDialogVisible = false
        return
      }
      const name = String(v).trim()
      if (!name) return
      if (this.personalLabelNames.indexOf(name) >= 0) {
        const hit = this.personalLabelOptions.find((l) => l.Name === name)
        if (hit) {
          if (this.hasLabel(hit.Id)) {
            this.$message.warning('该标签已经存在')
            return
          }
          this.applyLabelToFriend(hit.Id, false)
          this.selectDialogVisible = false
          return
        }
      }
      this.pendingNewLabelName = name
      UserLabelModifyTask(this.currentWeChatId, name, 0)
      this.selectDialogVisible = false
      this.$message.info('正在创建标签…')
    },
    modifyMemo() {
      if (!this.isCustomer) {
        this.$message.warning('请先选择客户好友')
        return
      }
      const nick = this.currentContact.Name || this.currentContact.RemoteId
      this.$prompt('修改 ' + nick + ' 的备注', '修改备注', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: this.currentContact.Alias || '',
        inputValue: this.currentContact.Alias || '',
        inputPattern: /^.{0,50}$/,
        inputErrorMessage: '备注长度 0-50'
      })
        .then(({ value }) => {
          const memo = (value || '').trim()
          SetUserMemoTask(this.currentWeChatId, this.currentContact.RemoteId, memo, this.currentContact.RemoteId)
          this.$store.commit('conversation/UPDATE_CURRENT_FRIEND', {
            wxid: this.currentWeChatId,
            contact: { ...this.currentContact, Alias: memo }
          })
          this.$message.info('正在设置备注…')
        })
        .catch(() => {})
    },
    deleteMemo() {
      if (!this.isCustomer) return
      if (!this.currentContact.Alias) {
        this.$message.warning('该好友没有备注')
        return
      }
      this.$confirm('删除备注？', '删除备注', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          SetUserMemoTask(this.currentWeChatId, this.currentContact.RemoteId, '', this.currentContact.RemoteId)
          this.$store.commit('conversation/UPDATE_CURRENT_FRIEND', {
            wxid: this.currentWeChatId,
            contact: { ...this.currentContact, Alias: '' }
          })
          this.$message.info('正在删除备注…')
        })
        .catch(() => {})
    },
    removeLabel(labelId, silent) {
      const doRemove = () => {
        const rid = this.toIdStr(this.currentContact.RemoteId)
        UserLabelSetTask({
          WxId: this.toIdStr(this.currentWeChatId),
          LabelId: this.toIdStr(labelId),
          IsCorp: !this.myLabels.some((id) => String(id) === String(labelId)),
          DelUsers: [rid],
          TaskId: rid
        })
        const next = (this.labelIds || []).filter((x) => String(x) !== String(labelId))
        this.patchFriendLabels(next)
      }
      if (silent) {
        doRemove()
        return
      }
      this.$confirm('移除该标签?', '移除标签', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(doRemove)
        .catch(() => {})
    },
    applyLabelToFriend(labelId, isCorp) {
      const rid = this.toIdStr(this.currentContact.RemoteId)
      UserLabelSetTask({
        WxId: this.toIdStr(this.currentWeChatId),
        LabelId: this.toIdStr(labelId),
        IsCorp: !!isCorp,
        AddUsers: [rid],
        TaskId: rid
      })
      if (!this.hasLabel(labelId)) {
        this.patchFriendLabels([...(this.labelIds || []), labelId])
      }
    },
    tryApplyPendingNewLabel() {
      const name = this.pendingNewLabelName
      if (!name || !this.currentContact.RemoteId) return
      let found = null
      for (const lg of this.currentLabels) {
        if (lg.Type === 2 && lg.Labels) {
          found = lg.Labels.find((l) => l.Name === name)
          if (found) break
        }
      }
      if (!found) return
      this.pendingNewLabelName = ''
      if (this.hasLabel(found.Id)) return
      this.applyLabelToFriend(found.Id, false)
      this.$message.success('已创建并打上标签')
    }
  }
}
</script>

<style lang="scss" scoped>
.label-remark {
  width: 100%;
  height: 100%;
  overflow: hidden;

  display: flex;
  flex-direction: column;
  align-items: center;

  .friend-item {
    width: 100%;
    margin: 5px 0;

    .friend-item-title {
      height: 30px;
      padding: 5px;
      background: $bg-color-nav-title-3;
      display: flex;
      align-items: center;
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
      .phone-item {
        padding: 5px 0;
        .delete-one-phone {
          margin-left: 20px;
        }
      }
      .el-tag {
        margin: 2px;
      }
    }
  }

  .friend-item-labels {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;

    .label-panel {
      flex: 1 1 auto;
      overflow: auto;
      max-height: none;
    }

    .label-empty {
      color: #909399;
      font-size: 12px;
      padding: 8px 4px;
    }

    .label-group-title {
      margin: 6px 0 4px;
      padding: 4px 6px;
      background: #ebeef5;
      font-size: 12px;
      color: #606266;
    }

    .label-chip-list {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
    }

    .label-class {
      color: #409eff;
      background-color: #ecf5ff;
      border-radius: 4px;
      border: 1px solid #d9ecff;
      display: inline-block;
      height: 28px;
      line-height: 26px;
      font-size: 12px;
      padding: 0 8px;
      margin: 2px;
      cursor: pointer;
      user-select: none;

      &.chose {
        color: #e6a23c;
        border-color: #f5dab1;
        background-color: #fdf6ec;
        font-weight: 600;
      }
    }
  }
}
</style>

