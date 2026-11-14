/**
 * element-ui → element-plus 兼容层
 *
 * 背景：Vue2 + element-ui 时代，组件里大量使用 this.$message / this.$confirm /
 * this.$alert / this.$prompt / this.$notify / this.$loading 等实例方法（共 300+ 处）。
 * element-plus 不再自动把这些方法挂到 globalProperties。
 *
 * 本插件把这些方法重新挂到 app.config.globalProperties，**不改业务代码**，
 * 让 element-ui 时代的 this.$xxx 调用继续可用。
 *
 * API 映射（element-ui 习惯 → element-plus 实现）：
 *   $message  → ElMessage          （this.$message({message,type}) 或 this.$message(text)）
 *   $alert    → ElMessageBox.alert
 *   $confirm  → ElMessageBox.confirm
 *   $prompt   → ElMessageBox.prompt
 *   $msgbox   → ElMessageBox
 *   $notify   → ElNotification
 *   $loading  → ElLoading.service
 *
 * 注意：
 *   - this.$message(text) 这种"只传字符串"的 element-ui 用法，element-plus 的 ElMessage
 *     要求传对象，这里做一层适配（字符串 → { message: text }）。
 *   - this.$message.success(text) 这种链式调用 element-ui 也支持，element-plus 的 ElMessage
 *     本身就有 .success/.error/.warning/.info 静态方法，直接透传。
 */

import { ElMessage, ElMessageBox, ElNotification, ElLoading } from 'element-plus'
import { h } from 'vue'

// $message：兼容 element-ui 两种用法（字符串 / 配置对象），并保留 .success 等链式方法
function $message(options) {
  if (options == null) return ElMessage()
  if (typeof options === 'string') {
    return ElMessage({ message: options })
  }
  return ElMessage(options)
}
// 透传 ElMessage 的静态方法（success/error/warning/info）
$message.success = (msg) => ElMessage.success(typeof msg === 'string' ? { message: msg } : msg)
$message.error = (msg) => ElMessage.error(typeof msg === 'string' ? { message: msg } : msg)
$message.warning = (msg) => ElMessage.warning(typeof msg === 'string' ? { message: msg } : msg)
$message.info = (msg) => ElMessage.info(typeof msg === 'string' ? { message: msg } : msg)
$message.closeAll = () => ElMessage.closeAll()

// $notify：同样兼容字符串入参
function $notify(options) {
  if (typeof options === 'string') {
    return ElNotification({ message: options })
  }
  return ElNotification(options)
}
$notify.success = (msg) => ElNotification.success(typeof msg === 'string' ? { message: msg } : msg)
$notify.error = (msg) => ElNotification.error(typeof msg === 'string' ? { message: msg } : msg)
$notify.warning = (msg) => ElNotification.warning(typeof msg === 'string' ? { message: msg } : msg)
$notify.info = (msg) => ElNotification.info(typeof msg === 'string' ? { message: msg } : msg)
$notify.closeAll = () => ElNotification.closeAll()

/**
 * workchat 业务用到的 el-icon-* 字体类名（扫描自源码，含 <i class> 和 icon="el-icon-*" prop）。
 * element-plus 已移除 el-icon 字体，这里注册同名组件（渲染 <i class="name">），
 * 让 icon="el-icon-search" 等 prop 在 element-plus 下继续显示。
 * <i class="el-icon-*"> 由 icon.css 直接生效，无需注册组件。
 */
const EL_ICON_FONT_NAMES = [
  'el-icon-arrow-down',
  'el-icon-chat-dot-round',
  'el-icon-chat-line-square',
  'el-icon-close',
  'el-icon-collection-tag',
  'el-icon-date',
  'el-icon-delete',
  'el-icon-document-remove',
  'el-icon-edit',
  'el-icon-edit-outline',
  'el-icon-film',
  'el-icon-info',
  'el-icon-key',
  'el-icon-loading',
  'el-icon-mic',
  'el-icon-minus',
  'el-icon-mobile-phone',
  'el-icon-picture-outline',
  'el-icon-picture-outline-round',
  'el-icon-plus',
  'el-icon-refresh',
  'el-icon-s-custom',
  'el-icon-s-promotion',
  'el-icon-search',
  'el-icon-service',
  'el-icon-star-off',
  'el-icon-switch-button',
  'el-icon-unlock',
  'el-icon-upload2',
  'el-icon-user-solid',
  'el-icon-video-camera',
  'el-icon-view',
  'el-icon-zoom-in'
]

/**
 * 把 el-icon-* 注册为渲染 <i class="name"> 的组件，
 * 让 element-plus 的 icon / prefix-icon / suffix-icon prop 认得旧字体名。
 */
function registerElIconFontAliases(app) {
  for (const name of EL_ICON_FONT_NAMES) {
    if (app._context && app._context.components && app._context.components[name]) continue
    app.component(name, {
      name,
      render: () => h('i', { class: name })
    })
  }
}

const compat = {
  install(app) {
    const gp = app.config.globalProperties
    gp.$message = $message
    gp.$msgbox = ElMessageBox
    gp.$alert = ElMessageBox.alert
    gp.$confirm = ElMessageBox.confirm
    gp.$prompt = ElMessageBox.prompt
    gp.$notify = $notify
    gp.$loading = ElLoading.service
    // 注册 el-icon-* 字体别名组件（icon="el-icon-search" 等 prop 用）
    registerElIconFontAliases(app)
  }
}

export default compat
