/**
 * axios封装
 * 请求拦截、响应拦截、错误统一处理
 */

import axios from 'axios'
import store from '../store'

const httpService = axios.create({
  timeout: 300000
})
httpService.defaults.headers.post['Content-Type'] =
  'application/x-www-form-urlencoded; charset=UTF-8'

function stripFormDataContentType(headers) {
  if (!headers) return
  delete headers['Content-Type']
  delete headers['content-type']
  if (headers.common) {
    delete headers.common['Content-Type']
    delete headers.common['content-type']
  }
  if (headers.post) {
    delete headers.post['Content-Type']
    delete headers.post['content-type']
  }
}

export function isFileUploadOk(res) {
  if (!res || !res.data || !res.data.url) return false
  const code = res.bizCode != null ? res.bizCode : res.code
  return code === 0
}

export function getFileUploadErrorMsg(res) {
  return (res && (res.msg || res.bizMsg)) || '文件上传失败!'
}

httpService.interceptors.request.use(
  (config) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      stripFormDataContentType(config.headers)
    }
    const token = store.state.httpToken
    if (token) {
      config.headers['token'] = token
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

httpService.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
)

/**
 * 文件上传
 * @param {FormData} params
 */
export function fileUpload(params = {}) {
  // chat-fileserver 据此写入 wework/ 前缀（个微 kelailaichatpc 仍为 com.jubo.pc → wechat/）
  params.append('packageName', 'com.jubo.workchat')
  return new Promise((resolve, reject) => {
    httpService({
      url: process.env.VUE_APP_UPLOAD_URL,
      method: 'post',
      data: params,
      headers: {
        'Content-Type': undefined
      }
    })
      .then((response) => resolve(response))
      .catch((error) => reject(error))
  })
}
