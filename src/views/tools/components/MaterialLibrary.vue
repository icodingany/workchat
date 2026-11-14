<template>
  <div class="material-library">
    <el-row type="flex" align="middle" style="padding: 10px 0">
      <el-select v-model="resourceType" size="small" placeholder="资源类型" filterable clearable>
        <el-option v-for="rt in resourceTypeList" :key="String(rt.value)" :label="rt.label" :value="rt.value" />
      </el-select>
      <el-button size="small" type="primary" style="margin-left: 10px" @click="queryResourceData">刷新素材</el-button>
    </el-row>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="Tips：在聚合聊天里对消息右键「收藏到素材库」添加；群发/自动回复/定时任务里可选素材发送。"
      style="margin-bottom: 10px"
    />

    <el-table :data="dataList" stripe height="100%" style="flex: 1">
      <el-table-column label="素材类型" width="110">
        <template #default="{ row }">
          <span>{{ typeLabel(row.type) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="消息内容" min-width="320">
        <template #default="{ row }">
          <div class="table-cell-content" v-html="previewContent(row)"></div>
        </template>
      </el-table-column>
      <el-table-column label="语义" prop="remarks" width="160" />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          <span>{{ formatTime(row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="editItem(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteItem(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin: 10px; align-self: center"
      :current-page="currentPage"
      :page-sizes="[20, 40, 60, 80]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next"
      :total="totalNum"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />

    <el-dialog title="编辑语义" v-model="editDialogVisible" width="480px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="素材类型">
          <span>{{ typeLabel(editRow.type) }}</span>
        </el-form-item>
        <el-form-item label="语义">
          <el-input v-model="editRemarks" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button size="small" @click="editDialogVisible = false">取消</el-button>
          <el-button size="small" type="primary" @click="saveEdit">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { resourcesList, deleteResources, updateResources } from '@/api/httpApi'
import {
  getEmojiPreviewSrc,
  getEmojiSendUrl,
  toHttpForWechatCdn,
  EMOJI_PLACEHOLDER_DATA_URL
} from '@/utils/emojiPayload'

const TYPE_MAP = {
  2: '图片',
  3: '语音',
  4: '视频',
  6: '链接',
  8: '文件',
  10: '位置',
  13: '小程序',
  14: '表情包',
  25: '视频号',
  Picture: '图片',
  Voice: '语音',
  Video: '视频',
  Link: '链接',
  File: '文件',
  WeApp: '小程序',
  Text: '文本',
  Emoji: '表情包'
}

export default {
  name: 'MaterialLibrary',
  data() {
    return {
      dataList: [],
      resourceType: null,
      pageSize: 20,
      currentPage: 1,
      totalNum: 0,
      editDialogVisible: false,
      editRow: {},
      editRemarks: '',
      resourceTypeList: [
        { label: '图片 (Picture)', value: 'Picture' },
        { label: '图片 (2)', value: 2 },
        { label: '语音 (Voice)', value: 'Voice' },
        { label: '视频 (Video)', value: 'Video' },
        { label: '视频 (4)', value: 4 },
        { label: '链接 (Link)', value: 'Link' },
        { label: '链接 (6)', value: 6 },
        { label: '小程序 (WeApp)', value: 'WeApp' },
        { label: '小程序 (13)', value: 13 },
        { label: '文件 (File)', value: 'File' },
        { label: '文本 (Text)', value: 'Text' },
        { label: '表情包 (Emoji)', value: 'Emoji' },
        { label: '表情包 (14)', value: 14 }
      ]
    }
  },
  watch: {
    resourceType() {
      this.currentPage = 1
      this.queryResourceData()
    }
  },
  created() {
    this.queryResourceData()
  },
  methods: {
    typeLabel(type) {
      return TYPE_MAP[type] || TYPE_MAP[String(type)] || type || '未知'
    },
    formatTime(t) {
      if (!t) return ''
      if (typeof t === 'number') {
        const d = new Date(t)
        return isNaN(d.getTime()) ? String(t) : d.toLocaleString()
      }
      return String(t).replace('T', ' ').slice(0, 19)
    },
    extractUrl(content) {
      if (!content) return ''
      const raw = typeof content === 'string' ? content.trim() : content
      if (typeof raw === 'string' && /^https?:\/\//.test(raw)) return toHttpForWechatCdn(raw) || raw
      try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
        const url =
          getEmojiSendUrl(obj) ||
          obj.url ||
          obj.Url ||
          obj.Thumb ||
          obj.cdnUrl ||
          obj.Content ||
          ''
        return url ? toHttpForWechatCdn(url) || url : ''
      } catch (e) {
        return typeof raw === 'string' ? raw.slice(0, 200) : ''
      }
    },
    parseContentObj(content) {
      if (!content) return null
      if (typeof content === 'object') return content
      try {
        return JSON.parse(content)
      } catch (e) {
        return null
      }
    },
    previewContent(row) {
      const t = row.type
      const c = row.content || ''
      if (t === 14 || t === '14' || t === 'Emoji') {
        const obj = this.parseContentObj(c)
        const src = obj ? getEmojiPreviewSrc(obj) : EMOJI_PLACEHOLDER_DATA_URL
        return `<img src="${src}" referrerpolicy="no-referrer" style="max-height:80px;max-width:160px;background:#f3f4f6" alt="[表情]" onerror="this.onerror=null;this.src='${EMOJI_PLACEHOLDER_DATA_URL}'" />`
      }
      if (t === 2 || t === 'Picture') {
        const url = this.extractUrl(c)
        return url ? `<img src="${url}" referrerpolicy="no-referrer" style="max-height:80px;max-width:160px" />` : this.escape(c)
      }
      if (t === 4 || t === 'Video') {
        const url = this.extractUrl(c)
        return url ? `<video src="${url}" controls style="max-height:100px;max-width:200px"></video>` : this.escape(c)
      }
      if (t === 3 || t === 'Voice') {
        const url = this.extractUrl(c)
        return url ? `<audio src="${url}" controls></audio>` : this.escape(c)
      }
      if (t === 6 || t === 'Link' || t === 13 || t === 'WeApp') {
        try {
          const obj = typeof c === 'string' ? JSON.parse(c) : c
          const title = (obj && (obj.title || obj.Title || obj.appName)) || ''
          const url = (obj && (obj.url || obj.Url || obj.pagePath)) || ''
          return this.escape(`${title} ${url}`.trim() || c)
        } catch (e) {
          return this.escape(String(c).slice(0, 300))
        }
      }
      return this.escape(String(c).slice(0, 300))
    },
    escape(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    },
    queryResourceData() {
      resourcesList(this.currentPage, this.pageSize, this.resourceType)
        .then((res) => {
          if (res.code === 0 && res.data) {
            this.dataList = res.data.rows || res.data.list || []
            this.totalNum = res.data.records || res.data.total || 0
          } else {
            this.$message.error((res && res.msg) || '加载失败')
          }
        })
        .catch(() => this.$message.error('加载素材失败'))
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1
      this.queryResourceData()
    },
    handleCurrentChange(page) {
      this.currentPage = page
      this.queryResourceData()
    },
    editItem(row) {
      this.editRow = row
      this.editRemarks = row.remarks || ''
      this.editDialogVisible = true
    },
    saveEdit() {
      updateResources(this.editRow.id, this.editRow.type, this.editRow.content, this.editRemarks).then((res) => {
        if (res.code === 0) {
          this.$message.success('已保存')
          this.editDialogVisible = false
          this.queryResourceData()
        } else {
          this.$message.error(res.msg || '保存失败')
        }
      })
    },
    deleteItem(id) {
      this.$confirm('确定删除该素材？', '提示', { type: 'warning' })
        .then(() => deleteResources(id))
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('已删除')
            this.queryResourceData()
          } else if (res) {
            this.$message.error(res.msg || '删除失败')
          }
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.material-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 10px;
  overflow: hidden;
}
.table-cell-content {
  max-height: 120px;
  overflow: auto;
  word-break: break-all;
  font-size: 12px;
}
</style>
