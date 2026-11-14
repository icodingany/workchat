/**
 * Vant 2 `this.$dialog` → Vant 4 函数式 API 兼容层。
 */
export function createVantDialogApi(apis) {
  const { showDialog, showConfirmDialog, closeDialog } = apis || {}

  return {
    confirm(options) {
      return showConfirmDialog(options)
    },
    alert(options) {
      return showDialog(options)
    },
    prompt(options = {}) {
      const tip = options.message || options.title || ''
      const value = typeof window !== 'undefined' ? window.prompt(tip) : null
      if (value == null) {
        return Promise.reject('cancel')
      }
      if (options.inputPattern && !options.inputPattern.test(value)) {
        return Promise.reject(options.inputErrorMessage || 'invalid')
      }
      return Promise.resolve(value)
    },
    close() {
      if (typeof closeDialog === 'function') {
        closeDialog()
      }
    }
  }
}
