import dataMixin from './data.js'
import computedMixin from './computed.js'
import watchMixin from './watch.js'
import lifecycleMixin from './lifecycle.js'
import methodsHistory from './methodsHistory.js'
import methodsImagePreview from './methodsImagePreview.js'
import methodsForward from './methodsForward.js'
import methodsMessage from './methodsMessage.js'
import methodsUi from './methodsUi.js'

/** 对齐 kelailaichatpc showChartsMixin：会话消息区逻辑，ShowChats.vue 只保留模板与样式 */
export const ShowChatsMixin = {
  data: dataMixin.data,
  computed: computedMixin.computed,
  watch: watchMixin.watch,
  created: lifecycleMixin.created,
  mounted: lifecycleMixin.mounted,
  beforeUnmount: lifecycleMixin.beforeUnmount,
  methods: {
    ...methodsHistory.methods,
    ...methodsImagePreview.methods,
    ...methodsForward.methods,
    ...methodsMessage.methods,
    ...methodsUi.methods
  }
}

export default ShowChatsMixin
