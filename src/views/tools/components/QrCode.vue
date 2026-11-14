<template>
  <div class="qr-code">
    <el-image class="qr-code-img" :src="qrCodeUrl" fit="cover">
      <template #error>
        <div class="image-slot">
          <i style="font-size: 100px" class="el-icon-picture-outline"></i>
        </div>
      </template>
    </el-image>
    <el-button type="primary" @click="refreshQrCode(currentWeChatId)">刷 新 二 维 码</el-button>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { PullMyQrCodeTask } from '@/api/webSocketApi'

export default {
  name: 'QrCode',
  data() {
    return {
      qrCodeUrl: ''
    }
  },
  computed: {
    ...mapGetters({
      currentWeChatId: 'conversation/currentWeChatId',
      qrCode: 'tools/qrCode'
    })
  },
  watch: {
    currentWeChatId(newId) {
      this.qrCodeUrl = ''
      this.getQrCode(newId)
    },
    qrCode(newCode) {
      this.qrCodeUrl = newCode[this.currentWeChatId]
    }
  },
  created() {
    this.getQrCode(this.currentWeChatId)
  },
  methods: {
    // 获取二维码
    getQrCode(wxid) {
      if (this.qrCode[wxid]) {
        this.qrCodeUrl = this.qrCode[wxid]
      } else {
        this.refreshQrCode(wxid)
      }
    },
    // 从手机获取二维码
    refreshQrCode(wxid) {
      if (wxid) {
        PullMyQrCodeTask(wxid)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.qr-code {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
