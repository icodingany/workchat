/**
 * Toast 插件（Vue3 版，当前未在 main.js 启用）。
 *
 * Vue2 用 Vue.extend + new Constructor + $mount；Vue3 已移除 Vue.extend，
 * 改用 createApp(组件).mount(container) 生成实例。
 *
 * 用法（main.js）：
 *   import Toast from '@/components/toast'
 *   app.use(Toast)
 *   // 模板/逻辑里：this.$toast('消息', 'success', 2000)
 */
import { createApp } from 'vue'
import ToastComponent from './Toast'

const Toast = {}

let instance = null

function ensureInstance() {
  if (instance) return instance
  const app = createApp(ToastComponent)
  // mount 需要一个真实容器；创建临时 div 后挂载，再移到 body
  const mountEl = document.createElement('div')
  document.body.appendChild(mountEl)
  instance = app.mount(mountEl)
  return instance
}

Toast.install = (app) => {
  app.config.globalProperties.$toast = (msg, type, duration = 2000) => {
    const inst = ensureInstance()
    inst.message = msg
    inst.type = type
    inst.show = true
    let ist = setTimeout(() => {
      inst.show = false
      clearTimeout(ist)
      ist = null
    }, duration)
  }
}

export default Toast
