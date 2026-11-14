import dayjs from 'dayjs'

// 当前零点
let currentDay = () => {
  let time = new Date().getTime()
  let date = new Date(time)
  let hour = date.getHours()
  let minutes = date.getMinutes()
  let seconds = date.getSeconds()
  let mills = date.getMilliseconds()
  time = time - hour * 60 * 60 * 1000 - minutes * 60 * 1000 - seconds * 1000 - mills
  return time
}

/**
 * 格式化时间戳（秒|毫秒）
 * @param {timestamp} value
 */
const timeFilter = (value) => {
  if (value) {
    value = value.toString()
    // taskId
    if (value.length === 17) {
      value = value.substr(0, 13)
    }
    if (value.length === 13) {
      return dayjs(Number(value)).format('YYYY-MM-DD HH:mm:ss')
    }
    return dayjs.unix(Number(value)).format('YYYY-MM-DD HH:mm:ss')
  } else {
    return '-'
  }
}

/**
 * 当前会话列表的 聊天的时间显示
 * @param {*} time
 */
const transformTime = (time) => {
  if (!time) return
  let nt = Number(time)
  if (time.length && time.length === 10) {
    nt = nt * 1000
  }
  let date = new Date(nt)
  let h = date.getHours()
  let m = date.getMinutes()
  if (time > currentDay) {
    if (m < 10) {
      return h + ':0' + m
    } else {
      return h + ':' + m
    }
  } else if (time > currentDay - 24 * 60 * 60 * 1000) {
    return '昨天'
  } else {
    let month = date.getMonth() + 1
    let day = date.getDate()
    return `${month}月${day}日`
  }
}

/**
 * 返回时间 精确到分
 * @param {*} YYYY-MM-DD HH:mm
 */
const transformTime2Minute = (time) => {
  if (time) {
    const date = new Date(time)
    const Y = date.getFullYear() + '-'
    const M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
    const D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ' '
    const h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':'
    const m = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()
    // let s = date.getSeconds()
    const nt = Y + M + D + h + m
    return nt
  } else {
    return ''
  }
}

/**
 * 手机号格式化
 * @param {String} phone
 */
const formatPhone = (phone) => {
  phone = phone.toString()
  return phone.substr(0, 3) + '****' + phone.substr(7, 11)
}

/**
 * 4位一空格（格式化银行卡）
 * @param {String} val
 */
const formatBank = (val) => {
  if (val) {
    return val
      .toString()
      .replace(/\s/g, '')
      .replace(/(.{4})/g, '$1 ')
  }
}

/**
 * 千分位格式化
 * @param {数字} val
 */
const toThousands = (val) => {
  let num = (val || 0).toString(),
    result = ''
  while (num.length > 3) {
    result = ',' + num.slice(-3) + result
    num = num.slice(0, num.length - 3)
  }
  if (num) {
    result = num + result
  }
  return result
}

/**
 * 格式化小数位
 * @param val 传入的值
 * @param pos 保留的小数位
 * @returns {*}
 */
const formatFloat = (val, pos = 2) => {
  let f = parseFloat(val)
  if (isNaN(f)) {
    return false
  }
  f = Math.round(val * Math.pow(10, pos)) / Math.pow(10, pos) // pow 幂
  let s = f.toString()
  let rs = s.indexOf('.')
  if (rs < 0) {
    rs = s.length
    s += '.'
  }
  while (s.length <= rs + pos) {
    s += '0'
  }
  return s
}

/**
 * 格式化时长
 * @param second
 * @returns {string}
 */
const realFormatSecond = (second) => {
  let secondType = typeof second

  if (secondType === 'number' || secondType === 'string') {
    second = parseInt(second)

    let hours = Math.floor(second / 3600)
    second = second - hours * 3600
    let mimute = Math.floor(second / 60)
    second = second - mimute * 60

    return hours + ':' + ('0' + mimute).slice(-2) + ':' + ('0' + second).slice(-2)
  } else {
    return '0:00:00'
  }
}

// ========================================

// 从红包key中获取发送者
const hbUrlFilter = (hbUrl) => {
  if (hbUrl) {
    let reg = /&sendusername=.+?&/
    let result = hbUrl.match(reg)[0]
    return result.replace('&sendusername=', '').replace('&', '')
  }
}

// 根据labelId获取labelName
const labelFilter = (labelId, labels) => {
  for (const label of labels) {
    if (label.LabelId === Number(labelId)) {
      return label.LabelName
    }
  }
  return labelId
}

/**
 * 获取文件名
 * @param {string} file
 */
const getFileName = (file) => {
  let name = file
  try {
    name = JSON.parse(file).name
    return name
  } catch (error) {
    return name.replace(/.*\//, '')
  }
}

/**
 * 返回好友来源
 * @param {*} sourceId
 */
const getFriendSource = (sourceId) => {
  let sourceMap = {
    1: '通过扫一扫添加',
    2: '通过搜索手机号添加',
    3: '通过名片分享添加',
    4: '通过群聊添加',
    5: '通过手机通讯录添加',
    6: '通过微信好友添加',
    7: '通过接受微信帐号收到的好友申请添加',
    8: '通过第三方应用专属客服添加',
    9: '通过搜索邮箱添加',
    10: '通过视频号添加'
  }
  if (sourceId && sourceMap[sourceId]) {
    return sourceMap[sourceId]
  }
  return '未知' + sourceId
}

export default {
  timeFilter,
  transformTime,
  transformTime2Minute,
  formatPhone,
  formatBank,
  toThousands,
  formatFloat,
  realFormatSecond,
  hbUrlFilter,
  labelFilter,
  getFileName,
  getFriendSource
}
