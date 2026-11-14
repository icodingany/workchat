/**
 * 全局注册 src/assets/icons/svg 下的图标组件。
 *
 * Vue CLI(webpack) 时代用 require.context 自动收集；Vite 改用 import.meta.glob。
 * Vue3 用 app.component 全局注册（在 main.js 里 import 本模块并传入 app 实例后调用）。
 *
 * 用法（main.js）：
 *   import { registerGlobalIcons } from '@/assets/icons'
 *   registerGlobalIcons(app)
 */
import { defineAsyncComponent } from 'vue'

const iconModules = import.meta.glob('./svg/*.vue', { eager: true })

export function registerGlobalIcons(app) {
  for (const filePath in iconModules) {
    // './svg/FriendCircle.vue' → 'FriendCircle'
    const componentName = filePath.replace(/^\.\/svg\//, '').replace(/\.vue$/, '')
    const mod = iconModules[filePath]
    app.component(componentName, mod.default || mod)
  }
}

// 兼容旧用法：默认导出按需加载的组件映射（key 为组件名，value 为异步组件）
const lazyIcons = {}
for (const filePath in iconModules) {
  const componentName = filePath.replace(/^\.\/svg\//, '').replace(/\.vue$/, '')
  lazyIcons[componentName] = defineAsyncComponent(iconModules[filePath])
}
export default lazyIcons
