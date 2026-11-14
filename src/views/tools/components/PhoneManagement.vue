<template>
  <div class="phone-management scroll">
    <div
      v-for="(wechat, index) in wechats"
      :key="index"
      class="wechat-info"
      :class="{ 'wechat-item': index % 5 === 3 }"
    >
      <div class="avatar-info">
        <el-avatar :size="44" :src="wechat.Avatar">
          <i class="fa fa-picture-o" aria-hidden="true" title="头像miss"></i>
        </el-avatar>
        <div class="other-info">
          <p class="ellipsis" style="color: #333333; font-size: 14px" :title="wechat.Name" v-text="wechat.Name"></p>
          <!-- <p class="ellipsis" style="color: #333333; font-size: 14px" :title="wechat.deviceid" v-text="wechat.deviceid"></p> -->

          <template v-if="phoneState[wechat.WxId]">
            <p class="ellipsis">电量: {{ phoneState[wechat.WxId].BatteryLevel }}</p>
            <p class="ellipsis">网络: {{ phoneState[wechat.WxId].NetType }}</p>
            <p v-if="chargingStateMap[phoneState[wechat.WxId].ChargingState]" class="ellipsis">
              充电方式: {{ chargingStateMap[phoneState[wechat.WxId].ChargingState] }}
            </p>
            <p v-else class="ellipsis">充电方式: 未知</p>
            <p class="">内存: {{ phoneState[wechat.WxId].SdcardFree }}</p>
          </template>
          <template v-else>
            <el-button
              class="el-button-my"
              link

              icon="el-icon-search"
              title="查询手机状态"
              @click="queryPhoneState(wechat)"
            >
              点击查看手机状态
            </el-button>
          </template>
        </div>
      </div>
      <div class="operation-btns">
        <el-button
          class="el-button-my"
          link

          icon="el-icon-switch-button"
          title="重启手机"
          style="color: red"
          @click="managerPhone(wechat, 1)"
        ></el-button>
        <el-button
          class="el-button-my"
          link

          icon="el-icon-upload2"
          title="上传日志"
          @click="managerPhone(wechat, 2)"
        ></el-button>
        <!-- <el-button
          class="el-button-my"
          link

          icon="el-icon-picture-outline-round"
          title="清除客服系统的图片缓存"
          @click="managerPhone(wechat, 4)"
        ></el-button> -->
        <!-- <el-button
          class="el-button-my"
          link

          icon="el-icon-film"
          title="清除微信的图片视频缓存"
          @click="managerPhone(wechat, 5)"
        ></el-button> -->
        <el-button
          class="el-button-my"
          link

          icon="el-icon-document-remove"
          title="清除手机缓存的文件url"
          @click="managerPhone(wechat, 6)"
        ></el-button>
        <el-button
          class="el-button-my"
          link

          icon="el-icon-search"
          title="查询手机状态"
          @click="queryPhoneState(wechat)"
        ></el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { PhoneStateTask, PhoneActionTask } from '@/api/webSocketApi'

export default {
  name: 'ToolsPhoneManagement',
  data() {
    return {
      // 0 未充电 1 充电中 2 已充满 4 未知
      chargingStateMap: {
        0: '未充电',
        1: '充电中',
        2: '已充满',
        3: '已插线,未充电',
        4: '未知'
      }
    }
  },
  computed: {
    ...mapGetters({
      wechats: 'conversation/wechats',
      phoneState: 'tools/phoneState'
    })
  },
  methods: {
    // 手机操作
    managerPhone(wechat, actionNumber) {
      const { WxId, Name } = wechat
      //   如果没有选中微信
      if (!WxId) {
        this.$message({
          message: '该微信不可用！',
          type: 'warning',
          duration: 1000
        })
        return
      }
      const tip = {
        1: `重启 ${Name} 所在的手机？`,
        2: `上传 ${Name} 的日志？`,
        // 3: `上传 微信：${Name} 的本地文件？`,
        // 4: `清除手机(${Name})中客服系统的图片缓存？`,
        // 5: `清除微信(${Name})的图片视频缓存？`,
        6: `清除手机(${Name})缓存的文件url（用于防止重复上传）？`
      }
      this.$confirm(tip[actionNumber], '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        PhoneActionTask(WxId, actionNumber)
        this.$message({
          type: 'success',
          message: '指令已经下发!',
          duration: 1000
        })
      })
    },
    // 查询手机状态
    queryPhoneState(wechat) {
      if (wechat.WxId) {
        PhoneStateTask(wechat.WxId)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.phone-management {
  flex: 1 1 auto;
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  overflow: auto;

  .wechat-info {
    width: 240px;
    height: 170px;
    border: solid #eeeeee 1px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: space-between;
    color: #999999;
    font-size: 14px;
    margin: 0 12px 16px 0;
    .avatar-info {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      // border: solid red 1px;

      .other-info {
        display: flex;
        flex-direction: column;
        p {
          padding: 5px 10px;
          font-size: 12px;
          width: 150px;
        }
      }
    }
    .operation-btns {
      width: 238px;
      height: 49px;
      border-radius: 0 0 5px 5px;
      background-color: #f8f8f8;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
  .wechat-item {
    margin-right: 0;
  }
}
</style>
