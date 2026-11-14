/**
 * 统一 WxId 为字符串，避免 GetWeChatsResp("123") 与 WwOnlineNotice(123) 严格相等失败导致重复条目。
 */
/**
 * 全系统 isonline 语义（与 wework-server tbl_wx_accountinfo 一致）：1=在线，0=离线。
 * 勿使用历史反序（0=在线 1=离线）。
 */
export const ISONLINE_ONLINE = 1
export const ISONLINE_OFFLINE = 0

/** 判断企微号是否在线（兼容 isonline 数字与历史 IsOnline 布尔） */
export function isWechatOnline(wechatOrRaw) {
  if (!wechatOrRaw) return false
  const raw =
    wechatOrRaw.isonline !== undefined && wechatOrRaw.isonline !== null
      ? wechatOrRaw.isonline
      : wechatOrRaw.IsOnline
  if (raw === ISONLINE_ONLINE || raw === '1' || raw === true) return true
  if (raw === ISONLINE_OFFLINE || raw === '0' || raw === false) return false
  return false
}

export function normalizeWxId(wxId) {
  if (wxId === null || wxId === undefined || wxId === '') return ''
  return String(wxId)
}

/** 会话/联系人 RemoteId、ConvId 等 ID 统一为字符串比较 */
export function normalizeId(id) {
  if (id === null || id === undefined || id === '') return ''
  return String(id)
}

export function sameWxId(a, b) {
  return normalizeWxId(a) === normalizeWxId(b)
}

export function sameId(a, b) {
  return normalizeId(a) === normalizeId(b)
}

/**
 * 会话 LocalId 保真：优先保留「看起来未丢精度」的字符串。
 * JS Number 对 >2^53 的 int64 会舍入；HTTP 快照常为完整串，WS 可能已是舍入后的 number。
 * @param {string|number} prevId
 * @param {string|number} nextId
 * @returns {string}
 */
export function preferSafeConvLocalId(prevId, nextId) {
  const prev = normalizeId(prevId)
  const next = normalizeId(nextId)
  if (!next || next === '0') return prev || next
  if (!prev || prev === '0') return next
  if (prev === next) return prev
  if (String(Number(prev)) === next && prev !== next) return prev
  if (String(Number(next)) === prev && next !== prev) return next
  return next
}

/** 在对象 map 中按 WxId 查找实际 key（兼容 number / string 混用） */
export function findMapKey(map, wxId) {
  const id = normalizeWxId(wxId)
  if (!id || !map) return id
  if (Object.prototype.hasOwnProperty.call(map, id)) return id
  const key = Object.keys(map).find((k) => normalizeWxId(k) === id)
  return key || id
}

/**
 * 将 GetWeChatsResp / WwOnlineNotice 等不同来源归一化为侧边栏微信对象。
 */
export function normalizeWechatRecord(source) {
  if (!source) return null

  const wxId = normalizeWxId(
    source.WxId !== undefined && source.WxId !== null && source.WxId !== ''
      ? source.WxId
      : source.wxid !== undefined
        ? source.wxid
        : source.wxId
  )
  const imei = source.IMEI || source.deviceid || source.DeviceId || ''
  if (!wxId && !imei) return null

  const isonline = isWechatOnline(source) ? ISONLINE_ONLINE : ISONLINE_OFFLINE

  const devnickname = String(
    source.devnickname || source.DevNickname || source.DevNickName || ''
  ).trim()

  return {
    AcctId: source.AcctId || '',
    Attr: source.Attr || source.attr || '',
    Avatar: source.Avatar || source.avatar || '',
    CorpId: source.CorpId || source.corpid || '',
    IMEI: imei,
    Name: source.Name || source.name || '',
    Phone: source.Phone || source.phone || '',
    WxId: wxId,
    devnickname,
    isonline
  }
}

/**
 * 合并微信记录：上线推送等不含备注时保留已有 devnickname。
 */
export function mergeWechatRecord(prev, next) {
  if (!prev) return next
  if (!next) return prev
  const merged = { ...prev, ...next }
  const nextRemark = String(next.devnickname || '').trim()
  const prevRemark = String(prev.devnickname || '').trim()
  if (!nextRemark && prevRemark) {
    merged.devnickname = prevRemark
  }
  return merged
}

/** 侧边栏展示名；preferDevNick 为 true 且有备注时显示备注，否则显示昵称 */
export function wechatDisplayName(wechat, preferDevNick = false) {
  if (!wechat) return ''
  const name = wechat.Name || ''
  if (!preferDevNick) return name
  const remark = String(wechat.devnickname || '').trim()
  return remark || name
}

export function findWechatIndex(wechats, wechat) {
  const wxId = normalizeWxId(wechat.WxId)
  const imei = wechat.IMEI || ''

  return wechats.findIndex((x) => {
    if (wxId && normalizeWxId(x.WxId) === wxId) return true
    if (imei && x.IMEI && x.IMEI === imei) return true
    return false
  })
}

export function dedupeWechats(wechats) {
  const result = []
  const list = Array.isArray(wechats) ? wechats : wechats ? [wechats] : []

  for (const item of list) {
    const normalized = normalizeWechatRecord(item)
    if (!normalized) continue

    const idx = findWechatIndex(result, normalized)
    if (idx >= 0) {
      result[idx] = mergeWechatRecord(result[idx], normalized)
    } else {
      result.push(normalized)
    }
  }

  return result
}

/** 企微协议头像 URL 前缀（与手机 ScrmClient.packConvItem 一致） */
export function normalizeAvatarUrl(url) {
  if (url == null) return ''
  const s = String(url).trim()
  if (!s) return ''
  return s
    .replace(/^X:WWH/i, 'http://wework.qpic.cn/bizmail')
    .replace(/^X:WHS/i, 'https://wework.qpic.cn/wwpic')
    .replace(/^X:WXH/i, 'http://wx.qlogo.cn/mmhead')
    .replace(/^X:3WXH/i, 'https://thirdwx.qlogo.cn/mmopen')
}

/** 企微群 RemoteId 高位 38（与手机 UserApi.isGroup 一致） */
export function isWeworkGroupRemoteId(remoteId) {
  const rid = normalizeId(remoteId)
  if (!rid) return false
  try {
    // eslint-disable-next-line no-undef
    return Number(BigInt(rid) >> 48n) === 38
  } catch (e) {
    return false
  }
}

/** 企微群默认占位图（单 Avatar 常为蓝气泡 logo，不能当九宫格/单图展示） */
export function isGenericWeworkGroupAvatarUrl(url) {
  const s = normalizeAvatarUrl(url)
  if (!s) return false
  if (/\/wwwx_/i.test(s)) return true
  if (/\/wwpic\/0(?:\?|$|\/)/i.test(s)) return true
  if (/\/wwpic3az\/wwwx_/i.test(s)) return true
  if (/bizmail\/[^/]*\/0(?:\?|$|\/)/i.test(s)) return true
  if (/wework\.qpic\.cn\/bizmail\/[^/]*default/i.test(s)) return true
  return false
}

function isGroupConvForAvatar(conv) {
  if (!conv || typeof conv !== 'object') return false
  if (Number(conv.Type) === 1) return true
  if (isWeworkGroupRemoteId(conv.RemoteId ?? conv.remoteId)) return true
  if (Array.isArray(conv.Members) && conv.Members.length > 0) return true
  if (Array.isArray(conv.members) && conv.members.length > 0) return true
  const raw = conv.AvatarList ?? conv.avatarList
  if (Array.isArray(raw) && raw.length > 0) return true
  return false
}

function dedupeAvatarUrls(urls) {
  const out = []
  const seen = new Set()
  for (const u of urls) {
    const normalized = normalizeAvatarUrl(u)
    if (!normalized || isGenericWeworkGroupAvatarUrl(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
    if (out.length >= 9) break
  }
  return out
}

function collectMemberAvatarUrls(conv) {
  const members = conv.Members ?? conv.members
  if (!Array.isArray(members)) return []
  const urls = []
  for (const m of members) {
    if (!m) continue
    const av = m.Avatar ?? m.avatar
    if (av != null && String(av).trim() !== '') urls.push(av)
  }
  return dedupeAvatarUrls(urls)
}

/**
 * 群聊九宫格头像：AvatarList → Members[].Avatar（兼容 avatarList 线格式）
 * 群聊忽略单字段 Avatar 中的企微默认 logo。
 */
export function getConversationAvatarList(conv) {
  if (!conv || typeof conv !== 'object') return []
  const raw = conv.AvatarList ?? conv.avatarList
  const fromList = Array.isArray(raw) ? dedupeAvatarUrls(raw) : []
  const fromMembers = collectMemberAvatarUrls(conv)
  if (fromMembers.length > 0) return fromMembers
  if (fromList.length > 1) return fromList
  if (fromList.length === 1 && !isGroupConvForAvatar(conv)) return fromList
  if (fromList.length === 1 && !isGenericWeworkGroupAvatarUrl(fromList[0])) return fromList
  return []
}

/**
 * 单图展示头像：群聊优先九宫格首图/成员头像，跳过企微默认群 logo。
 * 单聊仍优先 Avatar 字段。
 */
export function resolveConversationAvatarUrl(conv) {
  if (!conv || typeof conv !== 'object') return ''
  const grid = getConversationAvatarList(conv)
  if (grid.length > 0) return grid[0]
  if (isGroupConvForAvatar(conv)) {
    const direct = normalizeAvatarUrl(conv.Avatar ?? conv.avatar)
    if (direct && !isGenericWeworkGroupAvatarUrl(direct)) return direct
    return ''
  }
  const direct = normalizeAvatarUrl(conv.Avatar ?? conv.avatar)
  if (direct) return direct
  return ''
}

/**
 * 列表昵称旁企微后缀文案；空字符串表示不显示。
 * 规则：RemoteId>>48===28 为个微不标；群聊仅原 Suffix；其余企微单聊用 Suffix 或「企微」。
 * @param {object|null|undefined} message 会话/客户/联系人行
 * @param {object} [contactsMap] remoteId → 联系人详情
 * @returns {string}
 */
export function weComNickSuffix(message, contactsMap) {
  if (!message || typeof message !== 'object') return ''

  const rid = normalizeId(message.RemoteId)
  if (!rid) return ''

  let fromMap = ''
  if (contactsMap && typeof contactsMap === 'object') {
    const detail = contactsMap[rid] || contactsMap[message.RemoteId]
    if (detail && detail.Suffix) fromMap = String(detail.Suffix)
  }
  const suffix =
    (message.Suffix != null && message.Suffix !== '' ? String(message.Suffix) : fromMap) || ''

  const isGroup =
    (Array.isArray(message.Members) && message.Members.length > 0) ||
    (Array.isArray(message.AvatarList) && message.AvatarList.length > 0)
  if (isGroup) return suffix

  let high = NaN
  try {
    // eslint-disable-next-line no-undef
    high = Number(BigInt(rid) >> 48n)
  } catch (e) {
    return ''
  }
  if (!Number.isFinite(high)) return ''
  if (high === 28) return ''

  return suffix || '企微'
}
