/**
 * 红包/转账收取：纯逻辑（WW 字段 WxId / ConvId / MsgRemoteId），供单测与 ShowChats mixin。
 */
import { normalizeChatFields } from '@/utils/chatMessageFields'

/** 群聊 Content 去掉 sender: 前缀 */
export function stripGroupHbContent(content) {
  if (typeof content !== 'string' || !content) return content
  return content.replace(/\S+?:/, '').replace(/^\n+|\n+$/g, '')
}

/**
 * @param {object} chat
 * @param {boolean} [isGroup]
 */
export function parseHbJsonContent(chat, isGroup = false) {
  if (!chat) return null
  const base = normalizeChatFields(chat)
  let content = base.Content
  if (isGroup) content = stripGroupHbContent(content)
  if (typeof content !== 'string' || !/^\{/.test(content.trim())) return null
  try {
    return JSON.parse(content)
  } catch (_) {
    return null
  }
}

/**
 * @param {object} chat
 * @param {boolean} [isGroup]
 */
export function inferRedPacketOrTransfer(chat, isGroup = false) {
  const j = parseHbJsonContent(chat, isGroup)
  if (!j) return null
  if (j.PaySubType != null && typeof j.Feedesc !== 'undefined') return 'transfer'
  if (j.Key && (j.Title != null || j.TotalNum != null)) return 'redpacket'
  return null
}

export function isHbExpired(jContent) {
  if (!jContent || jContent.InvalidTime == null) return false
  const now = Math.floor(Date.now() / 1000)
  return now - Number(jContent.InvalidTime) >= 24 * 60 * 60
}

export function resolveMsgRemoteId(chat) {
  const base = normalizeChatFields(chat)
  return base.MsgRemoteId || ''
}

export function resolveMsgKey(jContent) {
  if (!jContent) return ''
  return jContent.Key || jContent.MsgKey || jContent.TransferId || ''
}

export function lookupLuckMoneyOpened(luckMoneyMap, chat, jContent) {
  const map = luckMoneyMap || {}
  const rid = resolveMsgRemoteId(chat)
  if (rid && map[rid]?.opened) return map[rid]
  const jKey = resolveMsgKey(jContent)
  if (!jKey) return null
  if (map['msgkey_' + jKey]?.opened) return map['msgkey_' + jKey]
  return Object.values(map).find(
    (d) =>
      d?.opened &&
      d?.MsgKey &&
      (d.MsgKey === jKey || (typeof d.MsgKey === 'string' && d.MsgKey.indexOf(jKey) >= 0))
  )
}

export function isTransferRefunded(chat, jContent, refundedTransferKeys, wxId) {
  if (!chat || !jContent) return false
  if (jContent.PaySubType === 4) return true
  const id = wxId || normalizeChatFields(chat).WxId
  if (!id) return false
  const keys = refundedTransferKeys || {}
  const possible = [jContent.Key, jContent.MsgKey, jContent.TransferId].filter(Boolean)
  return possible.some((k) => keys[`${id}:${k}`])
}

export function isTransferClaimed(chat, jContent, luckMoneyMap) {
  if (!chat || !jContent) return false
  if (jContent.PaySubType === 3) return true
  return !!lookupLuckMoneyOpened(luckMoneyMap, chat, jContent)
}

/**
 * @param {object} chat
 * @param {object} opts
 * @param {boolean} [opts.refuse]
 * @param {string|number} [opts.taskId]
 * @param {string|number} [opts.wxId]
 * @param {boolean} [opts.isGroup]
 * @param {'redpacket'|'transfer'|string} [opts.hbType]
 */
export function buildTakeLuckMoneyPayload(chat, opts = {}) {
  const base = normalizeChatFields(chat)
  const jContent = chat._jContent || parseHbJsonContent(chat, opts.isGroup)
  const MsgKey = resolveMsgKey(jContent)
  const hbType =
    opts.hbType ||
    chat._hbType ||
    inferRedPacketOrTransfer(chat, opts.isGroup) ||
    (base.ContentType === 'MoneyTrans' || base.ContentType === 12 || base.ContentType === '12'
      ? 'transfer'
      : 'redpacket')
  // 必须落到协议枚举名；非法 ContentType 会导致服务端 JsonFormat 抛「解码失败」，
  // 且 PC 对「解码失败」默认静默 → 表现为「等待手机」后无后续。
  const ContentType = hbType === 'transfer' ? 'MoneyTrans' : 'LuckyMoney'
  const payload = {
    WxId: opts.wxId || base.WxId,
    ConvId: base.ConvId,
    MsgRemoteId: base.MsgRemoteId,
    MsgKey,
    TaskId: opts.taskId || null,
    Refuse: opts.refuse === true,
    ContentType
  }
  return { payload, jContent, base }
}

export function formatTransferAmount(feedesc) {
  if (feedesc == null || feedesc === '') return '0.00'
  if (typeof feedesc === 'number') return (feedesc / 100).toFixed(2)
  const str = String(feedesc).replace(/[￥¥\s]/g, '')
  const num = parseFloat(str)
  return Number.isNaN(num) ? '0.00' : num.toFixed(2)
}

/**
 * 点击前校验：自己红包 / openim / 非 JSON / 过期。
 * @returns {{ ok: boolean, error?: string, jContent?: object, hbType?: string, base?: object }}
 */
export function canOpenHbChat(chat, opts = {}) {
  if (!chat) return { ok: false, error: '消息无效' }
  const isGroup = !!opts.isGroup
  const wxId = opts.wxId || normalizeChatFields(chat).WxId
  const base = normalizeChatFields(chat)
  const convHint = String(base.ConvId || '')
  if (convHint.endsWith('openim') || convHint.includes('@openim')) {
    return { ok: false, error: '企业微信外部联系人红包暂不支持' }
  }
  const jContent = parseHbJsonContent(chat, isGroup)
  if (!jContent) return { ok: false, error: '消息格式异常' }
  const hbType =
    opts.hbType ||
    inferRedPacketOrTransfer(chat, isGroup) ||
    (base.ContentType === 'MoneyTrans' || base.ContentType === 12 || base.ContentType === '12'
      ? 'transfer'
      : 'redpacket')
  if (hbType === 'redpacket' && sameSender(base.SenderId, wxId) && !isGroup) {
    return { ok: false, error: '不能打开自己的红包' }
  }
  if (hbType === 'redpacket' && sameSender(base.SenderId, wxId) && isGroup) {
    // 群聊也禁止开自己的红包（对齐产品）
    return { ok: false, error: '不能打开自己的红包' }
  }
  if (hbType === 'transfer' && sameSender(base.SenderId, wxId)) {
    return { ok: false, error: '自己发出的转账无需操作' }
  }
  if (isHbExpired(jContent)) {
    return { ok: false, error: hbType === 'transfer' ? '该转账已经过期' : '已过期' }
  }
  return { ok: true, jContent, hbType, base }
}

function sameSender(senderId, wxId) {
  if (senderId == null || wxId == null || senderId === '' || wxId === '') return false
  return String(senderId) === String(wxId)
}
