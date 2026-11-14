/**
 * Vant 2 `this.$toast` → Vant 4 函数式 API 兼容层。
 */
function withClearAlias(toast) {
  if (toast && typeof toast.clear !== 'function' && typeof toast.close === 'function') {
    toast.clear = function clear() {
      return toast.close()
    }
  }
  return toast
}

export function createVantToastApi(apis) {
  const { showToast, showFailToast, showSuccessToast, showLoadingToast, closeToast } = apis || {}

  const toastApi = (messageOrOpts) => withClearAlias(showToast(messageOrOpts))
  toastApi.fail = (msg) => withClearAlias(showFailToast(msg))
  toastApi.success = (msg) => withClearAlias(showSuccessToast(msg))
  toastApi.loading = (opts) => withClearAlias(showLoadingToast(opts))
  toastApi.clear = () => {
    if (typeof closeToast === 'function') closeToast()
  }
  return toastApi
}
