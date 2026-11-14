<template>
  <div class="personal-reply">
    <div class="toolbar">
      <el-button size="small" type="primary" @click="openAddTerm">新增话术</el-button>
      <el-button size="small" @click="openAddGroup">新建分组</el-button>
      <el-button size="small" icon="el-icon-refresh" @click="loadData" />
    </div>

    <div class="scroll groups">
      <div v-for="top in topGroups" :key="top.term_type_id" class="top-group">
        <div class="group-title" @click="toggle(top.term_type_id)">
          <span class="ellipsis">{{ top.name }}</span>
          <i class="fa" :class="collapsed[top.term_type_id] ? 'fa-chevron-circle-right' : 'fa-chevron-circle-down'" />
        </div>
        <template v-if="!collapsed[top.term_type_id]">
          <div v-for="child in top.children || []" :key="child.term_type_id" class="sub-group">
            <div class="sub-title">
              <span>{{ child.name }}</span>
              <i class="el-icon-plus" title="在此分组新增" @click.stop="openAddTerm(child.term_type_id)" />
            </div>
            <div
              v-for="term in child.terms || []"
              :key="term.term_id"
              class="term-item"
              @click="fillComposer(term)"
            >
              <span class="term-name ellipsis">{{ term.name }}</span>
              <span class="term-ops" @click.stop>
                <i class="el-icon-view" @click="togglePreview(term)" />
                <i class="el-icon-edit" @click="openEditTerm(term)" />
                <i class="el-icon-delete" @click="removeTerm(term)" />
              </span>
              <div v-if="previewId === term.term_id" class="term-preview">
                <p v-if="isText(term)" v-text="termContent(term)" />
                <img v-else-if="isPic(term)" :src="termContent(term)" alt="" />
                <span v-else>{{ ctypeLabel(term) }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
      <p v-if="!topGroups.length" class="empty">暂无个人话术，点击上方新增</p>
    </div>

    <el-dialog :title="termForm.id ? '编辑话术' : '新增话术'" v-model="termDialog" width="420px" append-to-body>
      <el-form label-width="70px" size="small">
        <el-form-item label="分组">
          <el-select v-model="termForm.groupId" filterable placeholder="选择分组" style="width: 100%">
            <el-option-group v-for="top in topGroups" :key="top.term_type_id" :label="top.name">
              <el-option
                v-for="child in top.children || []"
                :key="child.term_type_id"
                :label="child.name"
                :value="child.term_type_id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="termForm.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="termForm.ctype" style="width: 100%">
            <el-option label="文本" :value="'1'" />
            <el-option label="图片" :value="'2'" />
            <el-option label="视频" :value="'3'" />
            <el-option label="语音" :value="'4'" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="termForm.content" type="textarea" :rows="4" placeholder="文本内容或图片/视频/语音 URL" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button size="small" @click="termDialog = false">取消</el-button>
          <el-button size="small" type="primary" @click="saveTerm">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog title="新建分组" v-model="groupDialog" width="360px" append-to-body>
      <el-form label-width="80px" size="small">
        <el-form-item label="上级">
          <el-select v-model="groupForm.parentId" clearable placeholder="空=顶级组" style="width: 100%">
            <el-option v-for="top in topGroups" :key="top.term_type_id" :label="top.name" :value="top.term_type_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="groupForm.name" maxlength="30" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button size="small" @click="groupDialog = false">取消</el-button>
          <el-button size="small" type="primary" @click="saveGroup">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  getAccountTermsDetail,
  addAccountTerm,
  updateAccountTerm,
  deleteAccountTerm,
  addAccountTermType
} from '@/api/httpApi'

export default {
  name: 'PersonalReply',
  data() {
    return {
      topGroups: [],
      collapsed: {},
      previewId: null,
      termDialog: false,
      groupDialog: false,
      termForm: { id: null, groupId: null, name: '', content: '', ctype: '1' },
      groupForm: { name: '', parentId: null }
    }
  },
  created() {
    this.loadData()
  },
  methods: {
    loadData() {
      getAccountTermsDetail()
        .then((res) => {
          if (res.code === 0) {
            this.topGroups = res.data || []
          } else {
            this.$message.error(res.msg || '加载失败')
          }
        })
        .catch(() => this.$message.error('加载个人话术失败'))
    },
    toggle(id) {
      this.collapsed[id] = !this.collapsed[id]
    },
    togglePreview(term) {
      this.previewId = this.previewId === term.term_id ? null : term.term_id
    },
    termContent(term) {
      if (term.messages && term.messages.length) return term.messages[0].content || ''
      return term.content || ''
    },
    isText(term) {
      const t = String(term.ctype || (term.messages && term.messages[0] && term.messages[0].ctype) || '1')
      return t === '1'
    },
    isPic(term) {
      const t = String(term.ctype || (term.messages && term.messages[0] && term.messages[0].ctype) || '')
      return t === '2'
    },
    ctypeLabel(term) {
      const map = { 1: '文本', 2: '图片', 3: '视频', 4: '语音', 5: '文件' }
      return map[String(term.ctype)] || '消息'
    },
    fillComposer(term) {
      const ctype = String(term.ctype || '1')
      const typeMap = { 1: 'Text', 2: 'Picture', 3: 'Video', 4: 'Voice', 5: 'File' }
      const type = typeMap[ctype] || 'Text'
      const content = this.termContent(term)
      this.$store.commit('conversation/SET_CONTENT_TYPE', type)
      this.$nextTick(() => {
        this.$store.commit('conversation/SET_CONTENT', content)
      })
    },
    openAddTerm(groupId) {
      this.termForm = {
        id: null,
        groupId: groupId || this.defaultGroupId(),
        name: '',
        content: '',
        ctype: '1'
      }
      this.termDialog = true
    },
    openEditTerm(term) {
      this.termForm = {
        id: term.term_id,
        groupId: term.tid || term.groupId || this.findGroupId(term.term_id),
        name: term.name || '',
        content: this.termContent(term),
        ctype: String(term.ctype || '1')
      }
      this.termDialog = true
    },
    findGroupId(termId) {
      for (const top of this.topGroups) {
        for (const child of top.children || []) {
          if ((child.terms || []).some((t) => t.term_id === termId)) return child.term_type_id
        }
      }
      return null
    },
    defaultGroupId() {
      const top = this.topGroups[0]
      if (!top) return null
      const child = (top.children || [])[0]
      return child ? child.term_type_id : null
    },
    saveTerm() {
      if (!this.termForm.groupId || !this.termForm.name || !this.termForm.content) {
        this.$message.warning('请填写完整')
        return
      }
      const req = this.termForm.id
        ? updateAccountTerm({
            id: this.termForm.id,
            name: this.termForm.name,
            content: this.termForm.content,
            tid: this.termForm.groupId,
            isMulti: 0
          })
        : addAccountTerm({
            groupId: this.termForm.groupId,
            name: this.termForm.name,
            content: this.termForm.content,
            ctype: this.termForm.ctype,
            isMulti: 0
          })
      req.then((res) => {
        if (res.code === 0) {
          this.$message.success('已保存')
          this.termDialog = false
          this.loadData()
        } else {
          this.$message.error(res.msg || '保存失败')
        }
      })
    },
    removeTerm(term) {
      this.$confirm(`删除话术「${term.name}」？`, '提示', { type: 'warning' })
        .then(() => deleteAccountTerm(term.term_id))
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('已删除')
            this.loadData()
          } else if (res) {
            this.$message.error(res.msg || '删除失败')
          }
        })
        .catch(() => {})
    },
    openAddGroup() {
      this.groupForm = { name: '', parentId: this.topGroups[0] ? this.topGroups[0].term_type_id : null }
      this.groupDialog = true
    },
    saveGroup() {
      if (!this.groupForm.name) {
        this.$message.warning('请输入名称')
        return
      }
      addAccountTermType({
        name: this.groupForm.name,
        parentId: this.groupForm.parentId || 0
      }).then((res) => {
        if (res.code === 0) {
          this.$message.success('已创建')
          this.groupDialog = false
          this.loadData()
        } else {
          this.$message.error(res.msg || '创建失败')
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.personal-reply {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.toolbar {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
}
.groups {
  flex: 1;
  overflow: auto;
  padding: 4px 0;
}
.group-title,
.sub-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 13px;
}
.sub-title {
  background: #fafafa;
  margin-top: 2px;
  i {
    cursor: pointer;
    &:hover {
      color: #409eff;
    }
  }
}
.term-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  &:hover {
    background: #f0f9ff;
  }
}
.term-name {
  flex: 1;
  font-size: 13px;
  color: #333;
}
.term-ops {
  i {
    margin-left: 8px;
    color: #999;
    &:hover {
      color: #409eff;
    }
  }
}
.term-preview {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  color: #666;
  img {
    max-width: 80%;
    max-height: 80px;
  }
}
.empty {
  text-align: center;
  color: #999;
  margin-top: 40px;
  font-size: 13px;
}
</style>
