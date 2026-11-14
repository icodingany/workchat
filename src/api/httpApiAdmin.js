/**
 * 营销手机接口
 * xuyangyang
 * 2020-12
 */

import fetch from '@/utils/fetch'

/**
 * 登录
 * @param {string} account 账号
 * @param {string} password 密码
 */
export function login(account, password) {
  return fetch.post('/user/login', { account: account, password: password })
}

/**
 * SSO 兑换登录：用客徕徕端签发的 access token 换取企聊客服登录态。
 * 成功返回与 /user/login 相同的 LoginVO（含本端 token）。
 * @param {string} ssoToken 客徕徕端 HTTP access token（JWT）
 */
export function ssoLogin(ssoToken) {
  return fetch.post('/user/sso/login', { ssoToken: ssoToken })
}

/**
 * 修改密码
 * @param {string} newpwd 新密码
 * @param {string} oldpwd 老密码
 * @param {number} userid 用户id
 */
export function editPassword(userid, oldpwd, newpwd) {
  return fetch.post('/user/pwdedit', { userid: userid, oldpwd: oldpwd, newpwd: newpwd })
}

/**
 * 按当前登录公司查询所有可分配客服账号（cid 由后端从 JWT 解析）
 */
export function queryAccountsByCid() {
  return fetch.post('/user/account/queryByCid', {})
}

/**
 * 身份托管配置：managedExternally=true 时账号由客徕徕系统统一管理，
 * 本地增删改入口应隐藏（列表仍展示，数据来自客徕徕同步）。
 */
export function queryIdentityConfig() {
  return fetch.post('/user/account/identityConfig', {})
}

/**
 * 分页搜索查询账户
 * @param {number} cid 管理员的cid
 * @param {string} account 账号名称
 * @param {number} page 页码
 * @param {number} rows 每页数据量
 */
export function queryAccounts(account, page, rows) {
  return fetch.post('/user/account/pageList', { account: account, page: page, rows: rows })
}

/**
 * 查询账户数据
 * @param {number} id 账号的id
 */
export function queryAccountsById(id) {
  return fetch.post('/user/account/queryById', { id: id })
}

/**
 * 添加账户
 * @param {string} account 账号名称
 * @param {string} password 密码
 * @param {string} nickname 昵称
 * @param {number} state 账号状态1正常2禁用
 * @param {number} level 账号等级
 * @param {number} type 角色：1普通管理员 2普通员工
 */
export function addAccount(account, password, nickname, state, level, type = 2) {
  return fetch.post('/user/account/add', {
    account: account,
    password: password,
    nickname: nickname,
    state: state,
    level: level,
    type: type
  })
}

/**
 * 编辑账号
 * @param {number} id 账号id
 * @param {string} account 账号名称
 * @param {string} password 密码
 * @param {string} nickname 昵称
 * @param {number} state 账号状态1正常2禁用
 * @param {number} level 账号等级
 */
export function updateAccount(id, account, password, nickname, state, level) {
  return fetch.post('/user/account/update', {
    id: id,
    account: account,
    password: password,
    nickname: nickname,
    state: state,
    level: level
  })
}

/**
 * 删除账户
 * @param {*} ids 要删除的ids '11,12'
 */
export function deleteAccounts(ids) {
  return fetch.post('/user/account/deletes', { ids: ids })
}

// =============================================================

/**
 * 分页查询设备
 * @param {*} cid 管理员的cid
 * @param {*} page 页码
 * @param {*} rows 每页数据量
 * @param {*} deviceid 设备号
 * @param {*} wxid 微信id
 * @param {*} accountid 客服id
 * @param {*} isonline 微信在线状态：1在线 0离线
 */
export function queryDevices(page, rows, deviceid, wxid, accountid, isonline) {
  const data = {
    page: page,
    rows: rows,
    deviceid: deviceid,
    wxid: wxid,
    accountid: accountid,
    isonline: isonline
  }
  return fetch.post('/user/device/pageList', data)
}

/**
 * 删除设备
 * @param {string} ids
 */
export function deleteDevices(ids) {
  return fetch.post('/user/device/deletes', { ids: ids })
}

/**
 * 添加设备
 * @param {number} cid 管理员的cid
 * @param {string} deviceid 设备id（一般为imei）
 * @param {string|number|Array<number>} accountids 所属操作员账号 id，多个用逗号分隔或数组
 * @param {string} devnickname 设备名称
 * @param {string} brand 手机品牌
 * @param {string} module 手机型号
 */
function normalizeAccountIds(accountids) {
  if (Array.isArray(accountids)) {
    return accountids.join(',')
  }
  return accountids
}

/**
 * 添加设备（别名/品牌/型号由手机端登录同步，PC 不填）
 * @param {number} cid 管理员的cid
 * @param {string} deviceid 设备id（一般为imei）
 * @param {string|number|Array<number>} accountids 所属操作员账号 id，多个用逗号分隔或数组
 */
export function addDevice(deviceid, accountids, devnickname = '') {
  const accountidsStr = normalizeAccountIds(accountids)
  const firstAccountId = accountidsStr ? accountidsStr.split(',')[0] : ''
  return fetch.post('/user/device/add', {
    deviceid: deviceid,
    accountid: firstAccountId,
    accountids: accountidsStr,
    devnickname: devnickname || ''
  })
}

/**
 * 修改设备（只改设备号与操作员；别名/品牌/型号由手机端同步，后端不覆盖）
 * @param {number} id 设备id
 * @param {number} cid 管理员的cid
 * @param {string} deviceid 设备id（一般为imei）
 * @param {string|number|Array<number>} accountids 所属操作员账号 id，多个用逗号分隔或数组
 */
export function updateDevice(id, deviceid, accountids, devnickname = '') {
  const accountidsStr = normalizeAccountIds(accountids)
  const firstAccountId = accountidsStr ? accountidsStr.split(',')[0] : ''
  return fetch.post('/user/device/update', {
    id: id,
    deviceid: deviceid,
    accountid: firstAccountId,
    accountids: accountidsStr,
    devnickname: devnickname == null ? '' : String(devnickname)
  })
}

// =============================================================

/**
 * 分页搜索查询标签
 * @param {number} cid 必传
 * @param {string} name
 * @param {number} page 必传
 * @param {number} rows 必传
 */
export function queryCommonTags(name, page, rows) {
  return fetch.post('/user/commontag/pageList', { name: name, page: page, rows: rows })
}

/**
 * 删除公共标签
 * @param {string} ids 要删除的标签id
 */
export function deleteCommonTags(ids) {
  return fetch.post('/user/commontag/deletes', { ids: ids })
}

/**
 * 添加标签
 * @param {number} cid
 * @param {string} name 标签名
 */
export function addCommonTag(name) {
  return fetch.post('/user/commontag/add', { name: name })
}

/**
 * 修改标签
 * @param {number} id 标签id
 * @param {number} cid 管理员的cid
 * @param {string} name 标签名
 */
export function updateCommonTag(id, name) {
  return fetch.post('/user/commontag/update', { id: id, name: name })
}

// =============================================================

/**
 * 分页查询版本
 * @param {number} cid 管理员的cid
 * @param {string} version 版本名称
 * @param {number} vernumber 版本号
 * @param {string} packagename 包名
 * @param {number} flag 是否可用
 * @param {number} page 页码
 * @param {number} rows 数据量
 */
export function queryVersion(version, vernumber, packagename, flag, page, rows) {
  return fetch.post('/user/version/pageList', {
    version: version,
    vernumber: vernumber,
    packagename: packagename,
    flag: flag,
    page: page,
    rows: rows
  })
}

/**
 * 删除版本
 * @param {string} ids
 */
export function deleteVersion(ids) {
  return fetch.post('/user/version/deletes', { ids: ids })
}

/**
 * 添加版本
 * @param {number} cid 必传
 * @param {string} version 版本名称
 * @param {number} vernumber 版本号
 * @param {string} packagename 包名
 * @param {string} packageurl 安装包url
 */
export function addVersion(version, vernumber, packagename, packageurl) {
  return fetch.post('/user/version/add', {
    version: version,
    vernumber: vernumber,
    packagename: packagename,
    packageurl: packageurl
  })
}

/**
 * 修改版本信息
 * @param {*} id 版本id
 * @param {*} cid 管理员的cid
 * @param {*} version 版本名称
 * @param {*} vernumber 版本号
 * @param {*} packagename 包名
 * @param {*} packageurl 安装包url
 */
export function updateVersion(id, version, vernumber, packagename, packageurl) {
  return fetch.post('/user/version/update', {
    id: id,
    version: version,
    vernumber: vernumber,
    packagename: packagename,
    packageurl: packageurl
  })
}

/**
 * 推送更新
 * @param {*} id 版本id
 */
export function pushVersion(id) {
  return fetch.post('/user/version/push', { id: id })
}

// =============================================================

/**
 * 分页搜索查询术语
 * @param {number} cid 必传
 * @param {string} name 术语标题
 * @param {number} tid 术语分组id
 * @param {number} ctype 1文本类型 2图片类型 3视频类型 4语音类型 5其他文件类型
 * @param {number} page 必传
 * @param {number} rows 必传
 */
export function queryReplies(name, tid, ctype, page, rows) {
  return fetch.post('/user/commonterm/pageList', {
    name: name,
    tid: tid,
    ctype: ctype,
    page: page,
    rows: rows
  })
}

/**
 * 删除术语
 * @param {string} ids
 */
export function deleteReplies(ids) {
  return fetch.post('/user/commonterm/deletes', { ids: ids })
}

/**
 * 添加术语
 * @param {number} cid
 * @param {number} tid 所属分组
 * @param {string} name 标题
 * @param {number} ctype 1文本类型 2图片类型 3视频类型 4语音类型 5其他文件类型
 * @param {string} content 内容
 */
export function addReply(tid, name, ctype, content) {
  return fetch.post('/user/commonterm/add', {
    tid: tid,
    name: name,
    ctype: ctype,
    content: content
  })
}

/**
 * 更新术语
 * @param {number} id
 * @param {number} cid
 * @param {number} tid 所属分组
 * @param {string} name 标题
 * @param {number} ctype 1文本类型 2图片类型 3视频类型 4语音类型 5其他文件类型
 * @param {string} content 内容
 */
export function updateReply(id, tid, name, ctype, content) {
  return fetch.post('/user/commonterm/update', {
    id: id,
    tid: tid,
    name: name,
    ctype: ctype,
    content: content
  })
}

/**
 * 分页搜索查询术语分组
 * @param {number} cid 必传
 * @param {string} name
 * @param {number} page 必传
 * @param {number} rows 必传
 */
export function queryReplyTypes(name, page, rows) {
  return fetch.post('/user/commontermtype/pageList', { name: name, page: page, rows: rows })
}

/**
 * 查询所有术语分组
 * @param {*} cid
 */
export function queryReplyTypesByCid() {
  return fetch.post('/user/commontermtype/queryByCid', {})
}

/**
 * 删除术语分组
 * @param {string} ids
 */
export function deleteReplyGroup(ids) {
  return fetch.post('/user/commontermtype/deletes', { ids: ids })
}

/**
 * 添加术语分组
 * @param {number} cid 管理员的cid
 * @param {string} name 名称
 */
export function addReplyGroup(name) {
  return fetch.post('/user/commontermtype/add', { name: name })
}

/**
 * 更新术语分组
 * @param {number} id 术语分组id
 * @param {number} cid 管理员的cid
 * @param {string} name 名称
 */
export function updateReplyGroup(id, name) {
  return fetch.post('/user/commontermtype/update', { id: id, name: name })
}

// =============================================================

/**
 * 查询消息记录
 * @param {number} cid 管理员的cid
 * @param {string} wxid 微信id
 * @param {string} friendid 好友的微信id
 * @param {string} issend true发送的消息 false收到的消息
 * @param {string} contenttype 消息类型，具体对应proto文件
 * @param {number} type 0聊天消息  1群消息
 * @param {number} page 必传
 * @param {number} rows 必传
 */
export function queryMessages(wxid, friendid, issend, contenttype, type, page, rows) {
  const queryData = {
    wxid: wxid,
    friendid: friendid,
    issend: issend,
    contenttype: contenttype,
    type: type,
    page: page,
    rows: rows
  }
  return fetch.post('/user/messages/pageList', queryData)
}

/**
 * 删除消息记录
 * @param {string} ids
 */
export function deleteMessages(ids) {
  return fetch.post('/user/messages/deletes', { ids: ids })
}

/**
 * 通话记录分页搜索查询
 * @param {number} cid 必传
 * @param {string} number 电话号码
 * @param {number} type
 * @param {string} content
 * @param {string} record
 * @param {string} imei 设备号
 * @param {number} page 必传
 * @param {number} rows 必传
 */
export function queryCallLog(number, type, content, record, imei, page, rows) {
  const queryData = { // 必传
    number: number,
    type: type,
    content: content,
    record: record,
    imei: imei,
    page: page, // 必传
    rows: rows // 必传
  }
  return fetch.post('/user/call/pageList', queryData)
}

/**
 * 短信记录分页搜索查询
 * @param {number} cid
 * @param {string} number 电话号码
 * @param {number} type 发送状态
 * @param {string} content 短信内容
 * @param {string} read 阅读状态 true已读 false未读
 * @param {number} page
 * @param {number} rows
 */
export function queryShortMessage(number, type, content, read, page, rows) {
  const queryData = { // 必传
    number: number,
    type: type,
    content: content,
    readz: read,
    page: page, // 必传
    rows: rows // 必传
  }
  return fetch.post('/user/sms/pageList', queryData)
}

// =============================================================

/**
 * 分页搜索查询客户信息
 * @param {string} suppliername 客户名称
 * @param {string} admin 管理员账号
 * @param {number} page 必传
 * @param {number} rows 必传
 */
export function queryCustomers(suppliername, admin, page, rows) {
  return fetch.post('/admin/customer/pageList', { suppliername: suppliername, admin: admin, page: page, rows: rows })
}

/**
 * 添加客户
 * @param {string} suppliername 客户名称
 * @param {number} account_num 最大账号数量
 * @param {number} device_num 最大设备数量
 * @param {string} validity 服务期限
 * @param {number} state 客户状态 1正常 2禁用
 * @param {string} admin 管理员账号
 * @param {string} contact 联系人姓名
 * @param {string} phone 联系人电话
 * @param {string} description 备注信息
 */
export function addCustomer(
  suppliername,
  account_num,
  device_num,
  validity,
  state,
  admin,
  contact,
  phone,
  description
) {
  const addParameter = {
    suppliername: suppliername,
    account_num: account_num,
    device_num: device_num,
    validity: validity,
    state: state,
    admin: admin,
    contact: contact,
    phone: phone,
    description: description
  }
  return fetch.post('/admin/customer/add', addParameter)
}

/**
 * 更新客户信息
 * @param {number} id 客户id
 * @param {string} suppliername 客户名称
 * @param {number} account_num 最大账号数量
 * @param {number} device_num 最大设备数量
 * @param {string} validity 服务期限
 * @param {number} state 客户状态
 * @param {string} admin 管理员账号
 * @param {string} contact 联系人姓名
 * @param {string} phone 联系人电话
 * @param {string} description 备注信息
 */
export function updateCustomer(
  kid,
  suppliername,
  account_num,
  device_num,
  validity,
  state,
  admin,
  contact,
  phone,
  description
) {
  const updateParameter = {
    kid: kid,
    suppliername: suppliername,
    account_num: account_num,
    device_num: device_num,
    validity: validity,
    state: state,
    admin: admin,
    contact: contact,
    phone: phone,
    description: description
  }
  return fetch.post('/admin/customer/update', updateParameter)
}

/**
 * 删除客户
 * @param {string} ids 客户的id
 */
export function deleteCustomers(kids) {
  return fetch.post('/admin/customer/deletes', { kids: kids })
}

/**
 * 分页搜索查询全部设备列表
 * @param {number} page 必传
 * @param {number} rows 必传
 * @param {number} isonline 1在线 0离线
 * @param {string} wxid 微信id
 * @param {string} deviceid 设备号
 */
export function queryDevicesAll(page, rows, isonline, wxid, deviceid) {
  return fetch.post('/admin/device/pageList', {
    page: page,
    rows: rows,
    isonline: isonline,
    wxid: wxid,
    deviceid: deviceid
  })
}

// =============================================================
/**
 * 数据统计
 * @param {number} cid
 */
export function queryDataTongJi() {
  return fetch.post('/user/data/tongji', {})
}

/**
 * 数据统计报表
 * @param {number} cid 必传
 * @param {Date} start 开始日期时间戳，必传
 * @param {Date} end 结束日期时间戳，必传
 */
export function queryDataBaoBiao(start, end) {
  return fetch.post('/user/data/baobiao', { start: start, end: end })
}

/** 管理端：好友快照分页 */
export function pageWwContacts({ wxId, contactType, keyword, page, rows }) {
  return fetch.post('/user/wwContact/pageList', {
    wxId: wxId || '',
    contactType: contactType === '' || contactType === undefined ? null : contactType,
    keyword: keyword || '',
    page,
    rows
  })
}

/** 管理端：群快照分页 */
export function pageWwChatRooms({ wxId, roomType, keyword, page, rows }) {
  return fetch.post('/user/wwChatRoom/pageList', {
    wxId: wxId || '',
    roomType: roomType === '' || roomType === undefined ? null : roomType,
    keyword: keyword || '',
    page,
    rows
  })
}

/** 管理端：新增好友回复列表 */
export function listNewFriendReply() {
  return fetch.post('/user/newFriendReply/list', {})
}

/** 管理端：保存新增好友欢迎语 */
export function saveNewFriendReply({ wechatId, enabled, replyContent, startTime, endTime }) {
  return fetch.post('/user/newFriendReply/save', {
    wechatId,
    enabled,
    replyContent,
    startTime,
    endTime
  })
}

/** 管理端：切换新增好友欢迎语启用 */
export function toggleNewFriendReply(wechatId, enabled) {
  return fetch.post('/user/newFriendReply/toggle', { wechatId, enabled })
}

/** 管理端：自动任务详情（如 auto_type=1002） */
export function autoTaskDetail(wechatId, auto_type) {
  return fetch.post('/user/autoTask/detail', { wechatId, auto_type })
}

/** 管理端：自动任务更新（state: 0开 1关） */
export function autoTaskUpdate(wechatId, auto_type, state) {
  return fetch.post('/user/autoTask/update', { wechatId, auto_type, state })
}

/** 管理端：定时任务分页 */
export function taskTimePageList({ tasktype, wechatId, state, page, rows }) {
  return fetch.post('/user/taskTime/pageList', {
    tasktype: tasktype === '' || tasktype === undefined ? null : tasktype,
    wechatId: wechatId || '',
    state: state === '' || state === undefined ? null : state,
    page,
    rows
  })
}

/** 管理端：创建定时任务（群发/发圈） */
export function taskTimeAdd(payload) {
  return fetch.post('/user/taskTime/add', payload)
}

/** 管理端：更新任务状态 1开启 -1暂停 2取消 */
export function taskTimeUpdateState(id, state) {
  return fetch.post('/user/taskTime/updateState', { id, state })
}

/** 管理端：任务明细计数 */
export function taskTimeDetail(id) {
  return fetch.post('/user/taskTime/detail', { id })
}
