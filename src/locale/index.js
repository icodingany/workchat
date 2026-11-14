/**
 * 国际化（当前未启用，main.js 未 import）。
 *
 * Vue2 时代依赖 vue-i18n@8；本项目决定移除 vue-i18n（未实际接线）。
 * 这里保留一个最小可用占位：导出一个空 i18n 对象，避免万一被引用时报错。
 * 如后续需要启用国际化，可引入 vue-i18n@9 并改造为 createI18n。
 */
const browserLang = navigator.language || 'zh-CN'

const i18n = {
  global: {
    locale: 'zh-CN',
    fallbackLocale: browserLang || 'zh-CN',
    t: (key) => key
  }
}

export default i18n
