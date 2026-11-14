<template>
  <div class="coversation-view">
    <FirstPart />
    <SecondPart />
    <ThirdPart />
  </div>
</template>

<script>
import FirstPart from './components/firstPart'
import SecondPart from './components/secondPart'
import ThirdPart from './components/thirdPart'

export default {
  name: 'MainConversation',
  data() {
    return {
      routerViewName: 'conversation'
    }
  },
  components: {
    FirstPart,
    SecondPart,
    ThirdPart
  },
  mounted() {
    // 设置部门map
    this.$store.dispatch('conversation/SetDepartments')
    // HTTP 首屏拉企微号，不必等 AsidePage / WS 就绪
    this.$store.dispatch('conversation/FetchWechatsList')
  }
}
</script>

<style lang="scss" scoped>
.coversation-view {
  display: flex;
  flex: 1 1 auto;
  overflow: hidden;
  justify-content: space-between;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}
</style>
