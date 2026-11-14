<template>
  <div class="common-reply">
    <el-tabs v-model="activeName" @tab-click="handleClick">
      <el-tab-pane label="常用术语列表" name="reply">
        <!-- 搜索|新增 -->
        <div class="set-parameters">
          <el-input
            v-model="replyName"
            class="device-wechat-id"

            placeholder="请输入标题"
            clearable
            maxlength="20"
            show-word-limit
          ></el-input>
          <el-select v-model="replyCtype"  placeholder="请选择类型" filterable clearable>
            <el-option v-for="ctype in ctypes" :key="ctype.id" :label="ctype.label" :value="ctype.value"></el-option>
          </el-select>
          <el-select v-model="replyTid"  placeholder="请选择术语分组" filterable clearable>
            <el-option v-for="group in replyGroups" :key="group.id" :label="group.name" :value="group.id"></el-option>
          </el-select>
          <el-button type="primary"  @click="queryDataByCondition">查询</el-button>
          <el-button type="primary"  @click="showDialog">添加</el-button>
          <el-button @click="handleDownloadTemplate">下载模板</el-button>
          <el-button :loading="importing" @click="triggerImport">{{ importing ? '导入中' : '导入' }}</el-button>
          <el-button :loading="exporting" @click="handleExportCurrent">导出当前</el-button>
          <el-button :loading="exporting" @click="handleExportAll">导出全部</el-button>
          <input
            ref="replyImportInput"
            type="file"
            accept=".xlsx,.xls"
            style="display: none"
            @change="handleImportFile($event)"
          />
        </div>
        <!-- 信息展示 -->
        <el-table :data="tableData[activeName]" stripe>
          <el-table-column prop="tname" label="所属分组" header-align="center" align="center"></el-table-column>
          <el-table-column prop="name" label="术语标题" header-align="center" align="center"></el-table-column>
          <el-table-column prop="ctype" label="术语类型" header-align="center" align="center">
            <template #default="scope">
              <span v-text="ctypeMap[scope.row.ctype]"></span>
            </template>
          </el-table-column>
          <el-table-column prop="content" label="术语内容" header-align="center" align="center">
            <template #default="scope">
              <span :title="scope.row.content" class="message-content" v-text="scope.row.content"></span>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" header-align="center" align="center">
            <template #default="scope">
              <span v-text="$filters.transformTime2Minute(scope.row.create_time)"></span>
            </template>
          </el-table-column>
          <el-table-column label="操作" header-align="center" align="center">
            <template #default="scope">
              <el-button  @click="handleEdit(scope.$index, scope.row)">修改</el-button>
              <el-button

                style="background-color: #ff9f00; color: #ffffff"
                type="warning"
                @click="handleDelete(scope.$index, scope.row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <!-- 分页 -->
        <el-pagination
          :current-page="pageNo"
          :page-sizes="[20, 40, 60, 80]"
          :page-size="pageSize"
          :pager-count="5"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total[activeName]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        ></el-pagination>
      </el-tab-pane>

      <el-tab-pane label="术语分组列表" name="types">
        <!-- 搜索|新增 -->
        <div class="set-parameters">
          <el-input
            v-model="typeName"
            class="device-wechat-id"

            placeholder="请输入分组名称"
            clearable
            maxlength="20"
            show-word-limit
          ></el-input>
          <el-button type="primary"  @click="queryGroupDate">查询</el-button>
          <el-button type="primary"  @click="showGroupDialog">添加</el-button>
        </div>
        <!-- 数据展示 -->
        <el-table :data="tableData[activeName]" height="100%" stripe>
          <el-table-column prop="name" label="所属分组" header-align="center" align="center"></el-table-column>
          <el-table-column label="创建时间" header-align="center" align="center">
            <template #default="scope">
              <span v-text="$filters.transformTime2Minute(scope.row.create_time)"></span>
            </template>
          </el-table-column>
          <el-table-column label="操作" header-align="center" align="center">
            <template #default="scope">
              <el-button  @click="handleGroupEdit(scope.$index, scope.row)">修改</el-button>
              <el-button

                style="background-color: #ff9f00; color: #ffffff"
                type="warning"
                @click="handleDelete(scope.$index, scope.row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <!-- 分页 -->
        <el-pagination
          :current-page="groupPageNo"
          :page-sizes="[20, 40, 60, 80]"
          :page-size="groupPageSize"
          :pager-count="5"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total[activeName]"
          @size-change="handleTypeSizeChange"
          @current-change="handleTypeCurrentChange"
        ></el-pagination>
      </el-tab-pane>
    </el-tabs>

    <!-- 术语dialog -->
    <el-dialog append-to-body :title="dialogTitle" v-model="dialogVisible">
      <el-form ref="ruleForm" :model="replyForm" :rules="rules">
        <el-form-item label="所属分组" :label-width="formLabelWidth" prop="tid">
          <el-select v-model="replyForm.tid" placeholder="请选择术语分组" filterable clearable>
            <el-option v-for="group in replyGroups" :key="group.id" :label="group.name" :value="group.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="术语类型" :label-width="formLabelWidth" prop="ctype">
          <el-select v-model="replyForm.ctype" placeholder="请选择类型" filterable clearable>
            <el-option v-for="ctype in ctypes" :key="ctype.id" :label="ctype.label" :value="ctype.value"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="术语标题" :label-width="formLabelWidth" prop="name">
          <el-input
            v-model="replyForm.name"
            placeholder="请输入标签名"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
        <el-form-item label="内容" :label-width="formLabelWidth" prop="content">
          <el-input
            v-model="replyForm.content"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 4 }"
            placeholder="请输入内容"
            maxlength="500"
            show-word-limit
          ></el-input>
        </el-form-item>
        <el-form-item label="" :label-width="formLabelWidth">
          <label v-if="replyForm.ctype !== 1" style="cursor: poninter" class="label" for="sendFiles">选择文件</label>
          <input v-show="false" id="sendFiles" ref="toolsFile" type="file" maxlength="1" @change="choseMedia()" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div>
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateOrAddReply">确 定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 术语分组dialog -->
    <el-dialog append-to-body :title="groupDialogTitle" v-model="groupDialogVisible">
      <el-form ref="ruleGroupForm" :model="groupForm" :rules="groupRules">
        <el-form-item label="术语分组名称" :label-width="formLabelWidth" prop="name">
          <el-input
            v-model="groupForm.name"
            placeholder="请输入名称"
            clearable
            maxlength="20"
            show-word-limit
            autocomplete="off"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="groupDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateOrAddGroup">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { fileUpload } from '../../../utils/upload'
import {
  downloadReplyExcelTemplate,
  exportRepliesToExcel,
  readReplyExcelFile,
  parseReplyImportRows
} from '@/utils/replyImportExport'

import {
  queryReplies,
  queryReplyTypesByCid,
  deleteReplies,
  addReply,
  updateReply,
  queryReplyTypes,
  deleteReplyGroup,
  addReplyGroup,
  updateReplyGroup
} from '@/api/httpApiAdmin'

export default {
  name: 'CommonReplies',
  data() {
    return {
      activeName: 'reply',
      ctypeMap: {
        1: '文本类型',
        2: '图片类型',
        3: '视频类型',
        4: '语音类型',
        5: '其他文件类型'
      }, // 文件分类
      replyGroups: [], // 术语类型列表
      ctypes: [
        {
          id: 'ctypes1',
          value: 1,
          label: '文本类型'
        },
        {
          id: 'ctypes2',
          value: 2,
          label: '图片类型'
        },
        {
          id: 'ctypes3',
          value: 3,
          label: '视频类型'
        },
        {
          id: 'ctypes4',
          value: 4,
          label: '语音类型'
        },
        {
          id: 'ctypes5',
          value: 5,
          label: '其他文件类型'
        }
      ], // 术语分类列表
      replyName: '', // 名称
      replyTid: '', // 术语分组
      replyCtype: '', // 类型
      pageNo: 1, // 第几页
      pageSize: 20, // 每页几个数据
      dialogTitle: '添加术语',
      groupDialogTitle: '添加术语分组',
      dialogVisible: false, // 显示dialog
      groupDialogVisible: false, // 显示分组dialog
      formLabelWidth: '120px',
      replyForm: {
        id: '',
        cid: '', // 必传
        ctype: 1,
        tid: '', // 术语分类id
        content: '',
        name: ''
      }, // 表单
      groupForm: {
        id: '',
        cid: '', // 必传
        name: ''
      }, // 表单
      rules: {
        tid: [{ required: true, message: '请选择术语类型', trigger: 'blur' }],
        name: [{ required: true, message: '请输入标题', trigger: 'blur' }],
        ctype: [{ required: true, message: '请选择类型', trigger: 'blur' }],
        content: [{ required: true, message: '请输入内容', trigger: 'blur' }]
      }, // 表单验证
      groupRules: {
        name: [{ required: true, message: '请输入术语分组名称', trigger: 'blur' }]
      }, // 表单验证
      typeName: '',
      groupPageNo: 1,
      groupPageSize: 20,

      tableData: {
        reply: [],
        types: []
      }, // 表格中的数据
      total: {
        reply: 0,
        types: 0
      }, // 总数
      importing: false,
      exporting: false
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    })
  },
  mounted() {
    // 查询术语类型列表
    this.queryAllGroup()
    this.queryDataSilence()
  },
  methods: {
    // 选择图片|视频|语音|文件
    choseMedia() {
      const formdata = new FormData() // 上传
      const fileObj = this.$refs.toolsFile.files // 文件对象
      // 如果有选中文件
      if (fileObj[0]) {
        // 文件大小
        const fileSize = fileObj[0].size
        // 文件后缀
        const fileType = fileObj[0].name.replace(/.+\./, '').toLowerCase()
        // 文件大于10M不能发送
        if (fileSize > 10485760 || fileSize <= 0) {
          this.$message.warning('文件不能大于10M，文件不能是空文件')
          return
        }

        // 验证通过
        formdata.append('myfile', fileObj[0])

        const loading = this.$loading({
          lock: true,
          text: '文件上传中',
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        })

        // 如果是发送语音
        if (this.replyForm.ctype === 4) {
          // 如果选择的是mp3文件，文件上传到服务器，转为amr，返回amr的地址
          // 如果选择的是amr文件，直接上传到服务器，返回amr的地址
          if (fileType === 'mp3') {
            formdata.append('isMp3ToAmr', true)
          } else if (fileType === 'amr') {
            formdata.append('isAmrToMp3', false)
          }
          // 上传mp3 或者amr转为MP3
          const formDataMp3 = new FormData()
          formDataMp3.append('myfile', fileObj[0])
          if (fileType === 'mp3') {
            formDataMp3.append('isMp3ToAmr', false)
          } else if (fileType === 'amr') {
            formDataMp3.append('isAmrToMp3', true)
          }
          fileUpload(formDataMp3)
        }

        fileUpload(formdata)
          .then((res) => {
            this.replyForm.content = res.data.url
            loading.close()
            this.$forceUpdate()
            this.$refs.toolsFile.value = ''
          })
          .catch(() => {
            this.$message({
              message: '文件上传失败!',
              type: 'error',
              duration: 1000
            })
            loading.close()
          })
      }
    },
    queryAllGroup() {
      queryReplyTypesByCid().then((res) => {
        console.log(res)
        if (res.code === 0) {
          this.replyGroups = res.data || []
        }
      })
    },
    handleClick(tab) {
      if (tab.name === 'types') {
        this.queryGroupSilence()
      }
    },
    // 按条件查询术语
    queryDataByCondition() {
      this.handleCurrentChange(1)
    },
    // 分页查询数据
    queryData() {
      queryReplies(this.replyName, this.replyTid, this.replyCtype, this.pageNo, this.pageSize).then(
        (res) => {
          if (res.code === 0) {
            this.tableData['reply'] = res.data.rows || []
            this.total['reply'] = res.data.records || 0
            this.$message({
              type: 'success',
              message: '查询成功！',
              duration: 1000
            })
          }
        }
      )
    },
    // 静默查询数据
    queryDataSilence() {
      // 查询术语
      queryReplies(this.replyName, this.replyTid, this.replyCtype, this.pageNo, this.pageSize).then(
        (res) => {
          if (res.code === 0) {
            this.tableData['reply'] = res.data.rows || []
            this.total['reply'] = res.data.records || 0
          }
        }
      )
    },
    // 分页查询术语分组数据
    queryGroupDate() {
      queryReplyTypes(this.typeName, this.groupPageNo, this.groupPageSize).then((res) => {
        if (res.code === 0) {
          this.tableData['types'] = res.data.rows || []
          this.total['types'] = res.data.records || 0
          this.$message({
            type: 'success',
            message: '查询成功！',
            duration: 1000
          })
        }
      })
    },
    // 静默查询术语分组数据
    queryGroupSilence() {
      // 查询术语
      queryReplyTypes(this.typeName, this.groupPageNo, this.groupPageSize).then((res) => {
        if (res.code === 0) {
          this.tableData['types'] = res.data.rows || []
          this.total['types'] = res.data.records || 0
        }
      })
    },
    // 修改pageSize
    handleSizeChange(val) {
      if (this.pageSize === val) return
      this.pageSize = val
      this.queryData()
    },
    // 修改当前页
    handleCurrentChange(val) {
      this.pageNo = val
      this.queryData()
    },
    // 修改pageSize
    handleTypeSizeChange(val) {
      if (this.groupPageSize === val) return
      this.groupPageSize = val
      this.queryGroupDate()
    },
    // 修改当前页
    handleTypeCurrentChange(val) {
      this.groupPageNo = val
      this.queryGroupDate()
    },
    // 显示dialog
    showDialog() {
      this.resetForm()
      this.dialogTitle = '添加术语'
      this.dialogVisible = true
    },
    showGroupDialog() {
      this.resetGroupForm()
      this.groupDialogTitle = '添加术语分组'
      this.groupDialogVisible = true
    },
    // 修改或添加术语
    updateOrAddReply() {
      this.$refs['ruleForm'].validate((valid) => {
        if (valid) {
          const { id, tid, name, ctype, content } = this.replyForm
          if (this.dialogTitle === '添加术语') {
            addReply(tid, name, ctype, content).then((res) => {
              if (res.code === 0) {
                this.queryDataSilence()
                this.dialogVisible = false
                this.$message({
                  type: 'success',
                  message: '添加成功!',
                  duration: 1000
                })
              }
            })
          } else {
            updateReply(id, tid, name, ctype, content).then((res) => {
              if (res.code === 0) {
                this.dialogVisible = false
                this.queryDataSilence()
                this.$message({
                  type: 'success',
                  message: '更新成功',
                  duration: 1000
                })
              }
            })
          }
          if (this.$refs.elUpload) {
            this.$refs.elUpload.clearFiles()
          }
        } else {
          return false
        }
      })
    },
    updateOrAddGroup() {
      this.$refs['ruleGroupForm'].validate((valid) => {
        if (valid) {
          const { id, name } = this.groupForm
          if (this.groupDialogTitle === '添加术语分组') {
            addReplyGroup(name).then((res) => {
              if (res.code === 0) {
                this.queryGroupSilence()
                this.queryAllGroup()
                this.groupDialogVisible = false
                this.$message({
                  type: 'success',
                  message: '添加成功!',
                  duration: 1000
                })
              }
            })
          } else {
            updateReplyGroup(id, name).then((res) => {
              if (res.code === 0) {
                this.queryGroupSilence()
                this.queryAllGroup()
                this.groupDialogVisible = false
                this.$message({
                  type: 'success',
                  message: '更新成功!',
                  duration: 1000
                })
              }
            })
          }
        } else {
          return false
        }
      })
    },
    // 重置表单
    resetForm() {
      this.replyForm = {
        id: '',
        cid: '', // 必传
        ctype: 1,
        content: '',
        tid: '', // 术语分类id
        name: ''
      }
    },
    // 重置表单
    resetGroupForm() {
      this.groupForm = {
        id: '',
        cid: '', // 必传
        name: ''
      }
    },
    // 显示编辑dialog
    handleEdit(index, row) {
      for (const key in row) {
        if (row.hasOwnProperty(key)) {
          if (key === 'state') {
            this.replyForm[key] = row[key] === 1
          } else {
            this.replyForm[key] = row[key]
          }
        }
      }
      this.dialogTitle = '编辑术语'
      this.dialogVisible = true
    },
    handleGroupEdit(index, row) {
      for (const key in row) {
        if (row.hasOwnProperty(key)) {
          this.groupForm[key] = row[key]
        }
      }
      this.groupDialogTitle = '编辑术语分组'
      this.groupDialogVisible = true
    },
    // 删除
    handleDelete(index, row) {
      this.$confirm('是否删除设备？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          if (this.activeName === 'reply') {
            deleteReplies(row.id).then((res) => {
              if (res.code === 0) {
                const pn = Math.ceil((this.total[this.activeName] - 1) / this.pageSize)
                if (this.pageNo > pn) {
                  this.pageNo = pn
                }
                this.queryDataSilence()
                this.$message({
                  type: 'success',
                  message: '删除成功!',
                  duration: 1000
                })
              }
            })
          } else {
            deleteReplyGroup(row.id).then((res) => {
              if (res.code === 0) {
                const pn = Math.ceil((this.total[this.activeName] - 1) / this.pageSize)
                if (this.groupPageNo > pn) {
                  this.groupPageNo = pn
                }
                this.queryGroupSilence()
                this.queryAllGroup()
                this.$message({
                  type: 'success',
                  message: '删除成功!',
                  duration: 1000
                })
              }
            })
          }
        })
        .catch(() => {
          this.$message({
            type: 'info',
            message: '取消',
            duration: 1000
          })
        })
    },
    // ============ 批量导入 / 导出 ============
    handleDownloadTemplate() {
      try {
        downloadReplyExcelTemplate()
        this.$message.success('模板已开始下载')
      } catch (e) {
        console.error('下载模板失败:', e)
        this.$message.error('下载模板失败，请刷新后重试')
      }
    },
    triggerImport() {
      if (this.importing) return
      const input = this.$refs.replyImportInput
      if (input) {
        input.value = ''
        input.click()
      }
    },
    async handleImportFile(event) {
      const file = event.target.files && event.target.files[0]
      if (!file || this.importing) return

      let matrix
      try {
        matrix = await readReplyExcelFile(file)
      } catch (e) {
        console.error('解析Excel失败:', e)
        this.$message.error('读取Excel失败，请检查文件格式')
        return
      }
      const { valid, invalid } = parseReplyImportRows(matrix)
      if (valid.length === 0) {
        this.$message.warning(
          invalid.length
            ? `没有可导入的有效数据，${invalid.length} 行校验失败`
            : '文件中没有可导入的数据'
        )
        return
      }
      const invalidTip =
        invalid.length > 0
          ? `\n\n校验失败 ${invalid.length} 行：\n${invalid
              .slice(0, 5)
              .map((it) => `· 第${it.row}行：${it.reason}`)
              .join('\n')}${invalid.length > 5 ? `\n...等${invalid.length}条` : ''}`
          : ''
      try {
        await this.$confirm(
          `共解析到 ${valid.length} 条有效话术。确认导入？${invalidTip}`,
          '导入确认',
          {
            confirmButtonText: '确定导入',
            cancelButtonText: '取消',
            type: invalid.length > 0 ? 'warning' : 'info'
          }
        )
      } catch (_) {
        return
      }
      await this.doImportTerms(valid)
    },
    async doImportTerms(rows) {
      this.importing = true
      const loading = this.$loading({
        lock: true,
        text: '正在导入话术…',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.6)'
      })
      let okCount = 0
      let failCount = 0
      try {
        const groupMap = await this.ensureImportGroups(rows)
        for (let i = 0; i < rows.length; i++) {
          const item = rows[i]
          const groupId = groupMap[item.subName]
          if (!groupId) {
            console.warn('未找到目标分组，跳过:', item)
            failCount++
            continue
          }
          loading.text = `正在导入 ${i + 1}/${rows.length}…`
          try {
            const content = (item.messages || []).map((m) => m.content || '').join('\n')
            const ctype = item.ctype || (item.messages[0] && item.messages[0].ctype) || 1
            const res = await addReply(groupId, item.name, ctype, content)
            if (res && res.code === 0) {
              okCount++
            } else {
              failCount++
            }
          } catch (e) {
            console.error(`导入第 ${i + 1} 条话术失败:`, item.name, e)
            failCount++
          }
        }
        await this.refreshReplyGroups()
        this.queryDataSilence()
        if (failCount === 0) {
          this.$message.success(`导入完成，共 ${okCount} 条`)
        } else {
          this.$message.warning(`导入完成：成功 ${okCount} 条，失败 ${failCount} 条`)
        }
      } catch (e) {
        console.error('导入异常:', e)
        this.$message.error('导入过程中出现异常')
      } finally {
        loading.close()
        this.importing = false
      }
    },
    /** 按二级分组名确保分组存在，返回 { subName -> id } */
    async ensureImportGroups(rows) {
      await this.refreshReplyGroups()
      const map = this.collectGroupMap()
      const missing = new Set()
      rows.forEach((r) => {
        if (r.subName && !map[r.subName]) missing.add(r.subName)
      })
      for (const name of missing) {
        try {
          const res = await addReplyGroup(name)
          if (res && res.code === 0) {
            await this.refreshReplyGroups()
            const refreshed = this.collectGroupMap()
            Object.assign(map, refreshed)
          }
        } catch (e) {
          console.error('创建分组失败:', name, e)
        }
      }
      return map
    },
    collectGroupMap() {
      const map = {}
      ;(this.replyGroups || []).forEach((g) => {
        const name = g.name || g.tname
        const id = g.id || g.term_type_id
        if (name && id) map[name] = id
      })
      return map
    },
    refreshReplyGroups() {
      return queryReplyTypesByCid().then((res) => {
        if (res.code === 0) {
          this.replyGroups = res.data || []
        }
      })
    },
    async handleExportCurrent() {
      const list = this.tableData['reply'] || []
      if (!list.length) {
        this.$message.warning('当前没有可导出的数据')
        return
      }
      await this.runExport(list)
    },
    async handleExportAll() {
      try {
        const rows = await this.fetchAllReplyRows()
        if (!rows.length) {
          this.$message.warning('没有可导出的数据')
          return
        }
        await this.runExport(rows)
      } catch (e) {
        console.error('导出全部失败:', e)
        this.$message.error('导出失败，请重试')
      }
    },
    async fetchAllReplyRows() {
      const PAGE = 100
      const MAX_PAGES = 50
      const all = []
      let page = 1
      while (page <= MAX_PAGES) {
        const res = await queryReplies('', '', '', page, PAGE)
        if (!res || res.code !== 0 || !res.data) break
        const chunk = res.data.rows || []
        all.push(...chunk)
        const records = res.data.records || 0
        if (chunk.length < PAGE || all.length >= records) break
        page++
      }
      return all
    },
    async runExport(rows) {
      this.exporting = true
      const loading = this.$loading({
        lock: true,
        text: '正在生成Excel…',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.5)'
      })
      try {
        const ts = this.formatTimestamp(new Date())
        exportRepliesToExcel(rows, `公共话术-${ts}.xlsx`)
        this.$message.success('导出成功')
      } catch (e) {
        console.error('导出失败:', e)
        this.$message.error('导出失败，请重试')
      } finally {
        loading.close()
        this.exporting = false
      }
    },
    formatTimestamp(date) {
      const p = (n) => String(n).padStart(2, '0')
      return (
        `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
        `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
      )
    }
  }
}
</script>

<style lang="scss" scoped>
.common-reply {
  height: 100%;
  display: flex;
  flex-direction: column;

  .set-parameters {
    padding: 10px 5px;
    display: flex;
    align-items: center;
    border-bottom: solid $border-color-1 2px;
    .el-button,
    .wechat-id-input,
    .el-select {
      margin-left: 20px;
    }
    :deep(.device-wechat-id) {
      width: 220px;
      .el-input__inner {
        width: 220px;
      }
    }
  }

  :deep(.el-tabs) {
    overflow: hidden;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    .el-tabs__header {
      margin: 0;
    }
    .el-tabs__content {
      flex: 1 1 auto;
      .el-tab-pane {
        height: 100%;
        display: flex;
        flex-direction: column;
        .el-table {
          flex: 1 1 auto;
        }
      }
    }
  }

  .el-pagination {
    padding: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-top: solid 1px $border-color-1;
    background-color: white;
  }

  :deep(.message-content) {
    @include ellipsis(1);
  }
}
</style>
