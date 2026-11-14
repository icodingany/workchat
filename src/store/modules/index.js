/**
 * 自动收集 store/modules 下所有 vuex 模块。
 *
 * Vue CLI(webpack) 时代用 require.context，Vite 不支持 require.context，
 * 改用 import.meta.glob（eager: 同步加载，返回 { path: module } 映射）。
 */

// eager:true 同步导入，import: 'default' 直接取模块的 default 导出（即 vuex module 对象）
// 用 * 匹配后运行时再跳过 index.js（picomatch 的 !(index) 语法在某些 Vite 版本下行为不一致）
const moduleFiles = import.meta.glob('./*.js', { eager: true, import: 'default' })

const modules = {}

for (const filePath in moduleFiles) {
  // './conversation.js' → 'conversation'
  const moduleName = filePath.replace(/^\.\//, '').replace(/\.js$/, '')
  if (moduleName === 'index') continue
  modules[moduleName] = moduleFiles[filePath]
}

export default modules
