<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="720px"
    append-to-body
    @update:model-value="emitVisible"
    @open="onOpen"
  >
    <div class="material-picker">
      <el-radio-group v-model="activeType" size="small" style="margin-bottom: 10px" @change="queryRows">
        <el-radio-button v-for="t in accept" :key="t" :value="t">{{ label(t) }}</el-radio-button>
      </el-radio-group>

      <el-table :data="rows" v-loading="loading" height="320" highlight-current-row @current-change="onPick">
        <el-table-column label="素材内容" min-width="320">
          <template #default="{ row }">
            <div class="cell-preview" v-html="preview(row)"></div>
          </template>
        </el-table-column>
        <el-table-column label="语义" prop="remarks" width="140" show-overflow-tooltip />
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            <span>{{ formatTime(row.createTime) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <el-button size="small" @click="emitVisible(false)">取 消</el-button>
      <el-button size="small" type="primary" :disabled="!picked" @click="confirm">确 定</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { resourcesList } from '@/api/httpApi'
import { normalizeMaterialType, parseMaterialContent, filterMaterialsByType } from '@/utils/resourcePayload'

const TYPE_LABEL = {
  Text: '文本',
  Picture: '图片',
  Voice: '语音',
  Video: '视频',
  File: '文件',
  Link: '链接',
  WeApp: '小程序'
}

/**
 * 收藏素材选择弹窗（群发 MsgComposer / 发朋友圈 FriendCircleSend 共用）。
 * 按类型筛选 /user/resources/pageList 收藏素材，选中后 emit('select', row) 由调用方回填。
 */
export default {
  name: 'MaterialPickerDialog',
  props: {
    /** Vue3 v-model 显隐 */
    modelValue: {
      type: Boolean,
      default: false
    },
    /** 允许选择的素材类型（协议名） */
    accept: {
      type: Array,
      default: () => ['Text', 'Picture', 'Voice', 'Video', 'File', 'Link', 'WeApp']
    },
    title: {
      type: String,
      default: '从素材库选择'
    }
  },
  data() {
    return {
      activeType: this.accept && this.accept[0],
      rows: [],
      picked: null,
      loading: false
    }
  },
  watch: {
    modelValue(v) {
      if (v) this.picked = null
    }
  },
  methods: {
    label(t) {
      return TYPE_LABEL[t] || t
    },
    emitVisible(v) {
      this.$emit('update:modelValue', v)
    },
    onOpen() {
      if (this.accept.indexOf(this.activeType) < 0) {
        this.activeType = this.accept[0]
      }
      this.queryRows()
    },
    queryRows() {
      this.picked = null
      this.loading = true
      // 库内新旧 type 混存（'Picture' 与 2 并存），后端 type 精确匹配会漏数字行；
      // 拉全量后按协议名客户端过滤
      resourcesList(1, 500, null)
        .then((res) => {
          this.loading = false
          const all = (res && res.code === 0 && res.data && (res.data.rows || res.data.list)) || []
          this.rows = filterMaterialsByType(all, this.activeType)
        })
        .catch(() => {
          this.loading = false
          this.rows = []
        })
    },
    onPick(row) {
      this.picked = row || null
    },
    confirm() {
      if (!this.picked) return
      this.$emit('select', this.picked)
      this.emitVisible(false)
    },
    escape(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    },
    formatTime(t) {
      if (!t) return ''
      if (typeof t === 'number') {
        const d = new Date(t)
        return isNaN(d.getTime()) ? String(t) : d.toLocaleString()
      }
      return String(t).replace('T', ' ').slice(0, 19)
    },
    preview(row) {
      const type = normalizeMaterialType(row.type)
      const c = parseMaterialContent(row.content)
      if (type === 'Picture') {
        const url = typeof c === 'string' ? c : (c && c.url) || ''
        return url
          ? `<img src="${this.escape(url)}" referrerpolicy="no-referrer" style="max-height:72px;max-width:140px" />`
          : '-'
      }
      if (type === 'Video') {
        const url = typeof c === 'string' ? c : (c && c.url) || ''
        return url ? `<video src="${this.escape(url)}" style="max-height:80px;max-width:160px"></video>` : '-'
      }
      if (type === 'Voice') {
        const url = typeof c === 'string' ? c : (c && c.url) || ''
        return url ? `<audio src="${this.escape(url)}" controls style="max-width:220px"></audio>` : '-'
      }
      if (type === 'Link' || type === 'WeApp') {
        const title = (c && (c.title || c.appName)) || ''
        const url = (c && (c.url || c.pagePath)) || ''
        return this.escape(`${title} ${url}`.trim())
      }
      return this.escape(typeof c === 'string' ? c.slice(0, 200) : JSON.stringify(c).slice(0, 200))
    }
  }
}
</script>

<style lang="scss" scoped>
.material-picker {
  .cell-preview {
    max-height: 90px;
    overflow: hidden;
    word-break: break-all;
    font-size: 12px;
  }
}
</style>
