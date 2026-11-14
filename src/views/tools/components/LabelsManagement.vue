<template>
  <div class="labels-management scroll">
    <div v-for="(lg, index) in currentLabels" :key="'userLabels' + index">
      <!-- 标签组名 -->
      <div class="label-group-name">
        <span style="margin-right: 10px" class="can-not-select" v-text="lg.Name"></span>
        <el-button v-if="lg.Type === 2" type="primary"  icon="el-icon-collection-tag" @click="createLabel">
          创建标签
        </el-button>
      </div>
      <!-- 标签 -->
      <el-tag class="label-tag" v-for="(label, index) in lg.Labels" :key="'label' + index">
        <span class="can-not-select" v-text="label.Name"></span>
        <template v-if="lg.Type === 2">
          <el-button
            style="margin-left: 10px; padding: 2px"

            type="primary"
            icon="el-icon-edit"
            circle
            title="修改标签"
            @click="modifyLabel(label)"
          ></el-button>
          <el-button
            style="padding: 2px"

            type="danger"
            icon="el-icon-delete"
            circle
            title="删除标签"
            @click="deleteLabel(label)"
          ></el-button>
        </template>
      </el-tag>
    </div>

    <el-button
      style="width: 200px; align-self: center; margin: 10px"
      type="primary"

      @click="refreshLabels"
    >
      刷新标签
    </el-button>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { TriggerUserLabelTask, UserLabelDelTask, UserLabelModifyTask } from '@/api/webSocketApi'

export default {
  name: 'LabelsManagement',
  data() {
    return {}
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId', // 当前微信id
      currentLabels: 'conversation/currentLabels' // 当前微信的所有标签
    }),
    // 个人标签的name
    labelNames() {
      let names = []
      this.currentLabels.forEach((lg) => {
        if (lg.Type === 2 && lg.Labels && lg.Labels.length > 0) {
          lg.Labels.forEach((label) => {
            names.push(label.Name)
          })
        }
      })
      return names
    }
  },
  watch: {
    currentWeChatId(newId) {
      if (newId) {
        TriggerUserLabelTask(this.currentWeChatId)
      }
    }
  },
  methods: {
    // // 获取标签
    refreshLabels() {
      TriggerUserLabelTask(this.currentWeChatId)
    },
    // 新建一个标签
    createLabel() {
      this.$prompt('标签名不能与现有的重复！', '新建标签', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /\S{1,200}/,
        inputErrorMessage: '标签长度不对'
      })
        .then(({ value }) => {
          if (this.labelNames.indexOf(value) > 0) {
            this.$message({
              type: 'warning',
              message: '该标签已经存在！',
              duration: 1000
            })
            return
          }
          UserLabelModifyTask(this.currentWeChatId, value, 0)
        })
        .catch(() => {})
    },
    // 修改标签
    modifyLabel(label) {
      this.$prompt(`原标签：<b style="color:green;"> ${label.Name} </b>`, '修改标签', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: label.Name,
        // inputValue: this.currentContact.Desc,
        dangerouslyUseHTMLString: true,
        inputPattern: /\S{1,20}/,
        inputErrorMessage: '标签长度1-20，不能含有特殊字符！'
      })
        .then(({ value }) => {
          UserLabelModifyTask(this.currentWeChatId, value, label.Id)
        })
        .catch(() => {
          this.$message({
            type: 'info',
            message: '取消',
            duration: 500
          })
        })
    },
    // 删除标签
    deleteLabel(label) {
      this.$confirm('确定删除该标签?', '删除标签', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          UserLabelDelTask(this.currentWeChatId, label.Id)
        })
        .catch(() => {
          this.$message({
            type: 'info',
            message: '取消',
            duration: 500
          })
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.labels-management {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;

  .label-group-name {
    font-size: 16px;
    font-weight: 600;
    height: 40px;
    line-height: 40px;
    padding-left: 5px;
    color: $font-color-1;
  }
  .label-tag {
    margin: 5px;
    font-weight: 400;
    font-size: 14px;
  }
}
</style>
