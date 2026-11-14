<template>
  <div class="ww-admin-page">
    <div class="tip-box">调度按分钟执行，实际约在整分触发。支持纯文本 / 图片 / 视频 / 链接朋友圈。</div>
    <div class="set-parameters">
      <el-input v-model="wechatId" clearable placeholder="企微号 WxId" class="filter-item" />
      <el-select v-model="state" clearable placeholder="状态" class="filter-item">
        <el-option label="全部" value="" />
        <el-option label="开启中" :value="1" />
        <el-option label="已完成" :value="0" />
        <el-option label="已暂停" :value="-1" />
        <el-option label="已取消" :value="2" />
      </el-select>
      <el-button type="primary" @click="queryData">查询</el-button>
      <el-button type="success" @click="openCreate">新建</el-button>
    </div>

    <div v-if="mobile" v-loading="loading" class="mobile-admin-cards">
      <div v-if="!loading && !tableData.length" class="empty-tip">暂无定时发圈任务</div>
      <article v-for="row in tableData" :key="row.id" class="mobile-admin-card">
        <header class="mobile-admin-card__head">
          <strong class="mobile-admin-card__title">{{ row.wechatId || '-' }}</strong>
          <span class="mobile-admin-card__badge">{{ stateMap[row.state] || '-' }}</span>
        </header>
        <dl class="mobile-admin-card__rows">
          <div class="mobile-admin-card__row">
            <dt>类型</dt>
            <dd>{{ restypeLabel(row.restype) }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>内容</dt>
            <dd>{{ row.content || '-' }}</dd>
          </div>
          <div class="mobile-admin-card__row">
            <dt>执行时间</dt>
            <dd>{{ row.execute_time || '-' }}</dd>
          </div>
        </dl>
        <div v-if="row.state === 1 || row.state === -1" class="mobile-admin-card__btns">
          <el-button v-if="row.state === 1" link @click="changeState(row, -1)">暂停</el-button>
          <el-button v-if="row.state === -1" link @click="changeState(row, 1)">恢复</el-button>
          <el-button link @click="changeState(row, 2)">取消</el-button>
        </div>
      </article>
    </div>

    <el-table v-else v-loading="loading" :data="tableData" stripe border height="100%">
      <el-table-column prop="wechatId" label="企微号" min-width="140" show-overflow-tooltip />
      <el-table-column label="类型" width="80" align="center">
        <template #default="scope">{{ restypeLabel(scope.row.restype) }}</template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
      <el-table-column prop="execute_time" label="执行时间" width="160" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="scope">{{ stateMap[scope.row.state] || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="scope">
          <el-button
            v-if="scope.row.state === 1"
            link
            @click="changeState(scope.row, -1)"
          >暂停</el-button>
          <el-button
            v-if="scope.row.state === -1"
            link
            @click="changeState(scope.row, 1)"
          >恢复</el-button>
          <el-button
            v-if="scope.row.state === 1 || scope.row.state === -1"
            link
            @click="changeState(scope.row, 2)"
          >取消</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!mobile && !loading && total === 0" class="empty-tip">暂无定时发圈任务</div>
    <el-pagination
      :current-page="pageNo"
      :page-sizes="[20, 40, 60]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />

    <el-dialog title="新建定时发圈" v-model="dialogVisible" width="560px" :modal="false">
      <el-form label-width="100px">
        <el-form-item label="企微号" required>
          <el-select v-model="form.wechatId" filterable clearable placeholder="请选择" style="width: 100%">
            <el-option
              v-for="item in wxOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="朋友圈类型" required>
          <el-radio-group v-model="form.circleType" @change="onCircleTypeChange">
            <el-radio-button value="text">纯文本</el-radio-button>
            <el-radio-button value="picture">图片</el-radio-button>
            <el-radio-button value="video">视频</el-radio-button>
            <el-radio-button value="link">链接</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="文本内容" :required="form.circleType === 'text'">
          <el-input
            v-model="form.text"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="这一刻的想法..."
          />
        </el-form-item>
        <el-form-item v-if="form.circleType === 'picture'" label="图片" required>
          <div class="upload-row">
            <label class="upload-btn" for="sm-picture">
              <i class="el-icon-plus"></i> 上传图片（最多9张）
            </label>
            <input
              v-show="false"
              id="sm-picture"
              ref="pictureInput"
              type="file"
              accept=".jpg,.png,.jpeg"
              multiple
              @change="chosePictures"
            />
          </div>
          <div class="thumb-list">
            <div v-for="(url, idx) in form.imageUrls" :key="idx" class="thumb-item">
              <img :src="url" alt="" />
              <i class="el-icon-close" @click="form.imageUrls.splice(idx, 1)"></i>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="form.circleType === 'video'" label="视频" required>
          <div class="upload-row">
            <label v-if="!form.videoUrl" class="upload-btn" for="sm-video">
              <i class="el-icon-plus"></i> 上传 mp4
            </label>
            <input
              v-show="false"
              id="sm-video"
              ref="videoInput"
              type="file"
              accept=".mp4"
              @change="choseVideo"
            />
            <template v-if="form.videoUrl">
              <video :src="form.videoUrl" controls style="max-height: 120px; max-width: 200px" />
              <el-button link @click="form.videoUrl = ''">删除</el-button>
            </template>
          </div>
        </el-form-item>
        <template v-if="form.circleType === 'link'">
          <el-form-item label="缩略图URL" required>
            <el-input v-model="form.linkImg" maxlength="500" clearable placeholder="链接缩略图地址" />
          </el-form-item>
          <el-form-item label="链接标题" required>
            <el-input v-model="form.linkTitle" maxlength="200" clearable placeholder="链接标题" />
          </el-form-item>
          <el-form-item label="链接地址" required>
            <el-input v-model="form.linkUrl" maxlength="500" clearable placeholder="https://..." />
          </el-form-item>
        </template>
        <el-form-item label="执行时间" required>
          <el-date-picker
            v-model="form.executeAt"
            type="datetime"
            format="YYYY-MM-DD HH:mm"
            value-format="x"
            placeholder="选择时间"
          />
          <el-button link @click="form.executeAt = Date.now()">立即</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" :loading="saving" @click="submitCreate">创 建</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { taskTimePageList, taskTimeAdd, taskTimeUpdateState, listNewFriendReply } from '@/api/httpApiAdmin'
import { fileUpload } from '@/utils/upload'
import { isMobile } from '@/utils/deviceDetector'

export default {
  name: 'ScheduledMoments',
  data() {
    return {
      loading: false,
      saving: false,
      wechatId: '',
      state: '',
      tableData: [],
      pageNo: 1,
      pageSize: 20,
      total: 0,
      stateMap: {
        1: '开启中',
        0: '已完成',
        '-1': '已暂停',
        2: '已取消'
      },
      dialogVisible: false,
      wxOptions: [],
      form: {
        wechatId: '',
        circleType: 'text',
        text: '',
        imageUrls: [],
        videoUrl: '',
        linkUrl: '',
        linkImg: '',
        linkTitle: '',
        executeAt: Date.now()
      }
    }
  },
  computed: {
    mobile() {
      return isMobile()
    }
  },
  created() {
    this.queryData()
  },
  methods: {
    restypeLabel(restype) {
      if (restype === 0) return '图片'
      if (restype === 1) return '视频'
      if (restype === 2) return '链接'
      return '文本'
    },
    queryData() {
      this.pageNo = 1
      this.fetchList()
    },
    fetchList() {
      this.loading = true
      taskTimePageList({
        tasktype: 4,
        wechatId: this.wechatId,
        state: this.state,
        page: this.pageNo,
        rows: this.pageSize
      })
        .then((res) => {
          if (res && res.code === 0 && res.data) {
            this.tableData = res.data.rows || []
            this.total = res.data.records || 0
          } else {
            this.$message.error((res && res.msg) || '查询失败')
          }
        })
        .catch(() => {
          this.$message.error('查询失败')
        })
        .finally(() => {
          this.loading = false
        })
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.fetchList()
    },
    handleCurrentChange(page) {
      this.pageNo = page
      this.fetchList()
    },
    changeState(row, state) {
      taskTimeUpdateState(row.id, state)
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('已更新')
            this.fetchList()
          } else {
            this.$message.error((res && res.msg) || '更新失败')
          }
        })
        .catch(() => {
          this.$message.error('更新失败')
        })
    },
    openCreate() {
      this.form = {
        wechatId: '',
        circleType: 'text',
        text: '',
        imageUrls: [],
        videoUrl: '',
        linkUrl: '',
        linkImg: '',
        linkTitle: '',
        executeAt: Date.now()
      }
      this.dialogVisible = true
      this.loadWxOptions()
    },
    onCircleTypeChange() {
      this.form.imageUrls = []
      this.form.videoUrl = ''
      this.form.linkUrl = ''
      this.form.linkImg = ''
      this.form.linkTitle = ''
    },
    loadWxOptions() {
      listNewFriendReply()
        .then((res) => {
          const rows = (res && res.data) || []
          this.wxOptions = rows
            .filter((r) => r && r.wechatId)
            .map((r) => ({
              value: r.wechatId,
              label: r.wechatName ? `${r.wechatName} (${r.wechatId})` : r.wechatId
            }))
        })
        .catch(() => {
          this.wxOptions = []
        })
    },
    transformTime(times) {
      const date = new Date(times)
      const pad = (n) => (n < 10 ? '0' + n : '' + n)
      return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        ' ' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes())
      )
    },
    uploadFile(file) {
      const formdata = new FormData()
      formdata.append('myfile', file)
      const loading = this.$loading({
        lock: true,
        text: '文件上传中',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.7)'
      })
      return fileUpload(formdata)
        .then((res) => {
          loading.close()
          return res
        })
        .catch((err) => {
          loading.close()
          this.$message.error('上传失败')
          throw err
        })
    },
    chosePictures() {
      const files = this.$refs.pictureInput && this.$refs.pictureInput.files
      if (!files || !files.length) return
      const remain = 9 - this.form.imageUrls.length
      if (remain <= 0) {
        this.$message.warning('最多 9 张图片')
        return
      }
      const list = Array.from(files).slice(0, remain)
      const jobs = list.map((file) => {
        if (file.type.indexOf('image') < 0) {
          this.$message.warning('请选择图片')
          return Promise.resolve(null)
        }
        if (file.size > 2 * 1024 * 1024) {
          this.$message.warning('单张图片不能超过 2MB')
          return Promise.resolve(null)
        }
        return this.uploadFile(file).then((res) => res.data.url)
      })
      Promise.all(jobs).then((urls) => {
        urls.filter(Boolean).forEach((u) => this.form.imageUrls.push(u))
        if (this.$refs.pictureInput) this.$refs.pictureInput.value = ''
      })
    },
    choseVideo() {
      const files = this.$refs.videoInput && this.$refs.videoInput.files
      if (!files || !files[0]) return
      const file = files[0]
      if (file.name.replace(/.+\./, '').toLowerCase() !== 'mp4') {
        this.$message.warning('仅支持 mp4')
        return
      }
      this.uploadFile(file).then((res) => {
        this.form.videoUrl = res.data.url
      })
    },
    submitCreate() {
      if (!this.form.wechatId) {
        this.$message.warning('请选择企微号')
        return
      }
      if (!this.form.executeAt) {
        this.$message.warning('请设置执行时间')
        return
      }
      let restype = -1
      let attachtcontent = ''
      const text = (this.form.text || '').trim()
      if (this.form.circleType === 'text') {
        if (!text) {
          this.$message.warning('请填写朋友圈文本')
          return
        }
        restype = -1
      } else if (this.form.circleType === 'picture') {
        if (!this.form.imageUrls.length) {
          this.$message.warning('请上传图片')
          return
        }
        restype = 0
        attachtcontent = this.form.imageUrls.join(',')
      } else if (this.form.circleType === 'video') {
        if (!this.form.videoUrl) {
          this.$message.warning('请上传视频')
          return
        }
        restype = 1
        attachtcontent = this.form.videoUrl
      } else if (this.form.circleType === 'link') {
        if (!this.form.linkUrl || !this.form.linkImg || !this.form.linkTitle) {
          this.$message.warning('请完整填写链接参数')
          return
        }
        restype = 2
        attachtcontent = [this.form.linkUrl, this.form.linkTitle, this.form.linkImg].join(',')
      }
      this.saving = true
      const payload = {
        tasktype: 4,
        state: 1,
        wechatId: this.form.wechatId,
        execute_time: this.transformTime(this.form.executeAt),
        content: text,
        restype
      }
      if (restype !== -1) {
        payload.attachtype = restype
        payload.attachtcontent = attachtcontent
      }
      taskTimeAdd(payload)
        .then((res) => {
          if (res && res.code === 0) {
            this.$message.success('创建成功')
            this.dialogVisible = false
            this.queryData()
          } else {
            this.$message.error((res && res.msg) || '创建失败')
          }
        })
        .catch(() => {
          this.$message.error('创建失败')
        })
        .finally(() => {
          this.saving = false
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.ww-admin-page {
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  .tip-box {
    margin-bottom: 10px;
    padding: 8px 12px;
    background: #f4f4f5;
    color: #606266;
    font-size: 13px;
    border-radius: 4px;
  }
  .set-parameters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
    .filter-item {
      width: 180px;
    }
  }
  .el-table {
    flex: 1;
  }
  .empty-tip {
    margin: 8px 0;
    color: #909399;
    font-size: 13px;
  }
  .el-pagination {
    margin-top: 12px;
    text-align: right;
  }
  .upload-btn {
    cursor: pointer;
    color: #576c95;
    font-size: 14px;
  }
  .thumb-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .thumb-item {
    position: relative;
    width: 64px;
    height: 64px;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 4px;
    }
    .el-icon-close {
      position: absolute;
      top: -4px;
      right: -4px;
      cursor: pointer;
      background: #fff;
      border-radius: 50%;
      font-size: 14px;
    }
  }
}
</style>
