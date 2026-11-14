import { markRaw } from 'vue'
import nedb from '../../db/nedb'
import base64 from '@/utils/base64'
import bus from '@/utils/bus'
import {
  dedupeWechats,
  getConversationAvatarList,
  ISONLINE_OFFLINE,
  ISONLINE_ONLINE,
  isWechatOnline,
  mergeWechatRecord,
  resolveConversationAvatarUrl,
  isGenericWeworkGroupAvatarUrl,
  normalizeAvatarUrl,
  wechatDisplayName,
  findMapKey,
  findWechatIndex,
  normalizeId,
  normalizeWechatRecord,
  normalizeWxId,
  preferSafeConvLocalId,
  sameId,
  sameWxId
} from '@/utils/wechat'

import { TriggerConversationPushTask } from '@/api/webSocketApi'
import {
  isStrangerContactDigest,
  pickConversationDigest,
  sortConversationsForDisplay
} from '@/utils/conversationSort'
import {
  queryChatHistory,
  fetchChatHistoryCursor,
  fetchConversationSnapshot,
  getChatHistoryCoverage,
  fetchCoverageGapMessages,
  GetWeChatsReq,
  resolvePcAccountId
} from '@/api/httpApi'
import {
  applyTalkResultToLocalMessages,
  enrichOutgoingNoticeFromLocalPreview,
  findLocalPreviewIndex,
  markLocalSendFailedInMessages,
  markLocalPendingSyncInMessages,
  normalizeSendFailChat,
  isSendFailedChat,
  isLocalSendingChat,
  isTalkToFriendTaskResultSuccess
} from '@/utils/localSendPreview'
import { mergeDedupeAndSort, insertChatSorted, appendIncomingChat, capMessagesTail, CURRENT_CHATS_SOFT_CAP } from '@/utils/chatMerge'
import { normalizeContentType, normalizeChatFields, shouldSkipEmptyIncomingChat } from '@/utils/chatMessageFields'
import {
  isMsgFieldDebugEnabled,
  logMsgFieldDebug,
  logMsgFieldAnomaly,
  snapshotMsgFields
} from '@/utils/msgFieldDebug'
import { applyDownloadUrlToMsgContent, markMessageResourceFetchFailed } from '@/utils/downloadFileDetail'
import {
  buildPinnedDigest,
  friendAddGreetingFromChat,
  isFriendAddGreetingDigest,
  shouldShowConversationUnreadBadge,
  mergeConversationUnreadCnt,
  mergeConversationTopFlag,
  detectAtMeInGroupTalk,
  isConversationDigestPinned,
  clearAtMePinFields
} from '@/utils/conversationDigest'
import {
  loadLocalChats,
  persistMessagesToLocalChats,
  persistIncomingRealtimeMessage,
  deleteLocalChat
} from '@/utils/historyChatLocalPersist'
import { normalizeSenderAccountName, applySenderAccountFields } from '@/utils/chatSenderAccount'

import { mapHistoryRowToTalk } from '@/utils/mapHistoryRowToTalk'

export { mapHistoryRowToTalk }
import {
  matchesCurrentChatSession,
  currentChatsBelongToSession
} from '@/utils/openSessionMatch'

export {
  applyTalkResultToLocalMessages,
  findLocalPreviewIndex,
  isLocalSendingChat
} from '@/utils/localSendPreview'

/** 同会话 OpenSession 进行中复用同一 Promise，避免连点叠多路 Dexie/HTTP/IDB */
const openSessionInflight = new Map()
/** 本地秒开 inflight */
const localChatLoadInflight = new Map()
/** HTTP 首屏 inflight */
const httpChatLoadInflight = new Map()

/** 会话镜像 HTTP 分页（后端 limit 最大 50；限流 2 次/秒） */
const CONVERSATION_SNAPSHOT_PAGE_SIZE = 50
const CONVERSATION_SNAPSHOT_DEFAULT_MAX = 200
const CONVERSATION_SNAPSHOT_PAGE_DELAY_MS = 550

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isConversationSnapshotRateLimited(res) {
  const msg = res && res.msg ? String(res.msg) : ''
  return res && res.code === -1 && msg.includes('频繁')
}

function enrichConversationVisualFields(conv) {
  if (!conv || typeof conv !== 'object') return conv
  const AvatarList = getConversationAvatarList(conv)
  const next = { ...conv }
  if (AvatarList.length) next.AvatarList = AvatarList
  const resolved = resolveConversationAvatarUrl(next)
  if (resolved) next.Avatar = resolved
  return next
}

function mergeConversationVisualFields(prev, incoming) {
  const incomingList = getConversationAvatarList(incoming)
  const prevList = prev ? getConversationAvatarList(prev) : []
  const AvatarList = incomingList.length ? incomingList : prevList
  const Members =
    Array.isArray(incoming.Members) && incoming.Members.length
      ? incoming.Members
      : prev && Array.isArray(prev.Members) && prev.Members.length
        ? prev.Members
        : undefined
  const merged = { ...incoming, AvatarList, Members }
  const resolved = resolveConversationAvatarUrl(merged)
  const prevAv = prev ? normalizeAvatarUrl(prev.Avatar ?? prev.avatar) : ''
  const incomingAv = normalizeAvatarUrl(incoming.Avatar ?? incoming.avatar)
  let Avatar = resolved || ''
  if (!Avatar && prevAv && !isGenericWeworkGroupAvatarUrl(prevAv)) Avatar = prevAv
  if (!Avatar && incomingAv && !isGenericWeworkGroupAvatarUrl(incomingAv)) Avatar = incomingAv
  return {
    ...(AvatarList.length ? { AvatarList } : {}),
    ...(Members ? { Members } : {}),
    ...(Avatar ? { Avatar } : {})
  }
}

function mapSnapshotRecord(r, wxId) {
  return enrichConversationVisualFields({
    ...r,
    WxId: wxId,
    Id: normalizeId(r.Id != null ? r.Id : r.id),
    RemoteId: normalizeId(r.RemoteId != null ? r.RemoteId : r.remoteId)
  })
}

/**
 * 全局打开会话代数：连点时只允许「最新一次」继续 commit/persist。
 * 每会话 inflight 仍会启动多路 await，但旧代数在 await 后立刻退出，避免十几次连点堵死 tab。
 */
let openSessionEpoch = 0
/** currentConvs 排序缓存：仅当 conversations 数组引用变化时重排 */
let _sortedConvsCache = { listRef: null, wxKey: '', contactsLen: -1, result: [] }

function bumpOpenSessionEpoch() {
  openSessionEpoch += 1
  return openSessionEpoch
}

function isOpenSessionEpoch(epoch) {
  return epoch === openSessionEpoch
}

/** 打开会话首屏条数（对齐 kelailaichatpc ~30） */
const OPEN_SESSION_PAGE_SIZE = 30

/**
 * Json数组去重
 * @param {Array} arr
 */
function unique(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (sameId(arr[i].RemoteId, arr[j].RemoteId)) {
        // 第一个等同于第二个，splice方法删除第二个
        arr.splice(j, 1)
        j--
      }
    }
  }
  return arr
}

/**
 * 浅拷贝会话列表并只改命中项（避免 JSON 深拷贝整表卡主线程）。
 * @param {Array} list
 * @param {(conv: object) => boolean} match
 * @param {(conv: object) => object} patch 接收已浅拷贝的命中项，返回更新后对象
 * @returns {Array|null} 有变更返回新数组，否则 null
 */
function patchConversationList(list, match, patch) {
  if (!Array.isArray(list) || !list.length) return null
  let hit = -1
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      hit = i
      break
    }
  }
  if (hit < 0) return null
  const next = list.slice()
  next[hit] = patch({ ...list[hit] })
  return next
}

/**
 * WS Content 为 base64；HTTP 历史为明文（文本/JSON）。
 * @param {string} content
 * @returns {string}
 */
function decodeMsgContent(content) {
  if (!content || typeof content !== 'string') return content || ''
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<')) {
    return content
  }
  try {
    return base64.decode(content)
  } catch (e) {
    return content
  }
}

/**
 * 归一发消息时间到毫秒（企微多为秒级 Unix）
 */
function normalizeMsgTimeMs(t) {
  if (t === null || t === undefined || t === '') return 0
  let n = Number(t)
  if (!Number.isFinite(n)) {
    const parsed = Date.parse(t)
    n = Number.isFinite(parsed) ? parsed : 0
  }
  if (n > 0 && n < 1e12) n *= 1000
  return n
}

/**
 * 会话消息旧→新排序（对齐 kelailaichatpc _sortChatsAsc / wei-kefu-be）
 * 键：msgTime → MsgRemoteId → MsgId → id
 */
export function sortChatsAsc(a, b) {
  const ta = normalizeMsgTimeMs(a && (a.MsgTime != null ? a.MsgTime : a.CreateTime))
  const tb = normalizeMsgTimeMs(b && (b.MsgTime != null ? b.MsgTime : b.CreateTime))
  if (ta !== tb) return ta - tb
  const ra = Number(a && a.MsgRemoteId) || 0
  const rb = Number(b && b.MsgRemoteId) || 0
  if (ra !== rb) return ra - rb
  const ma = Number(a && a.MsgId) || 0
  const mb = Number(b && b.MsgId) || 0
  if (ma !== mb) return ma - mb
  const ia = Number(a && a.id) || 0
  const ib = Number(b && b.id) || 0
  return ia - ib
}

/**
 * 获取消息的内容
 * @param {Object} talk 消息
 */
function getContent(talk) {
  let digest = ''
  const contentType = normalizeContentType(talk.ContentType)
  switch (contentType) {
    case 'Text':
    case 1:
      digest = decodeMsgContent(talk.Content)
      if (talk.Members) {
        digest = unescape(escape(digest.replace(/.*?:/, '')).replace('%0A', '%20')).replace(' ', '')
      }
      break
    case 'Picture':
    case 2:
      digest = '[图片]'
      break
    case 'Voice':
    case 3:
      digest = '[语音]'
      break
    case 'Video':
    case 4:
      digest = '[视频]'
      break
    case 'System':
    case 5:
      digest = decodeMsgContent(talk.Content) || '[系统消息]'
      // 对齐 kelailaichatpc：非联系人提示不参与会话列表摘要
      if (isStrangerContactDigest(digest)) {
        digest = ''
      }
      break
    case 'Link':
    case 6:
      digest = '[链接]'
      break
    case 'LinkExt':
    case 7:
      digest = '[链接]'
      break
    case 'File':
    case 8:
      digest = '[文件]'
      break
    case 'NameCard':
    case 9:
      digest = '[名片]'
      break
    case 'Location':
    case 10:
      digest = '[位置]'
      break
    case 'LuckyMoney':
    case 11:
      digest = '[红包]'
      break
    case 'MoneyTrans':
    case 12:
      digest = '[转账]'
      break
    case 'WeApp':
    case 13:
      digest = '[小程序]'
      break
    case 'Emoji':
    case 14:
      digest = '[表情]'
      break
    case 'RoomManage':
    case 15:
      digest = '[群管理]'
      break
    case 'Sys_LuckyMoney':
    case 16:
      digest = '[红包]'
      break
    case 'RoomSystem':
    case 17:
      digest = '[群通知]'
      break
    case 'BizLink':
    case 18:
      digest = '[公众号]'
      break
    case 'AudioCall':
    case 19:
      digest = '[语音通话]'
      break
    case 'VideoCall':
    case 20:
      digest = '[视频通话]'
      break
    case 'NotifyMsg':
    case 21:
      digest = '[服务通知]'
      break
    case 'QuoteMsg':
    case 22:
      digest = '[引用消息]'
      break
    case 'ForwardMsg':
    case 23:
      digest = '[聊天记录]'
      break
    case 'SnsNotify':
    case 24:
      digest = '[朋友圈通知]'
      break
    case 'ShiPinHao':
    case 25:
      digest = '[视频号]'
      break
    case 'AppFunCard':
    case 26:
      digest = '[功能卡片]'
      break
    case 'UnSupport':
    case 99:
      digest = '[不支持的消息]'
      break
    default:
      digest = '[不支持的消息]'
      break
  }
  return digest
}

/**
 * 用已加载消息矫正会话列表 Digest（对齐 kelailaichatpc SyncConversationDigestFromCurrentChats）
 */
function syncDigestFromMessages(state, commit, wxId, convId, messages) {
  if (!Array.isArray(messages) || messages.length === 0) return
  let digest = ''
  for (let i = messages.length - 1; i >= 0; i--) {
    digest = getContent(messages[i])
    if (digest) break
  }
  if (!digest) return
  const wechatId = normalizeWxId(wxId)
  const convKey = findMapKey(state.conversations, wechatId)
  const oldConvs = state.conversations[convKey]
  if (!oldConvs) return
  let changed = false
  const targetConvs = patchConversationList(
    oldConvs,
    (conv) => sameId(conv.RemoteId, convId),
    (conv) => {
      const next = pickConversationDigest(digest, conv.Digest)
      if (next && next !== conv.Digest) {
        changed = true
        conv.Digest = next
        return conv
      }
      if (isStrangerContactDigest(conv.Digest)) {
        changed = true
        conv.Digest = next || ''
        return conv
      }
      return conv
    }
  )
  if (changed && targetConvs) {
    commit('UPDATE_CONVERSATIONS', { wechatId, targetConvs })
  }
}

// initial state
const state = {
  // ============== AsidePage用到的变量 ==============
  wechats: [], // 当前用户绑定的微信
  currentWechat: {}, // 会话页面选中的微信

  conversations: {}, // 每个微信的会话
  currentCustomers: [], // 我的客户
  currentContacts: [], // 企业联系人
  allCustomers: [], // 所有的我的客户
  allContacts: [], // 所有的企业联系人
  currentFriends: {}, // 会话页面每个微信选中的好友

  // ============== ConversationFriends用到的变量 ====
  departments: [], // 当前的部门列表
  corporations: [], // 客户公司信息

  lastChatPages: {}, // ConversationFriends页面的tab页面回显
  addressListPages: {}, // ConversationFriends页面的tab页面回显
  chatRoomPages: {}, // ConversationFriends页面的tab页面回显
  // ============== ConversationChats用到的变量 =======
  currentChats: {
    Count: 0, // 消息数
    Messages: [], // 会话列表
    Size: 0, // 固定20
    ConvId: '', // 会话的remoteid
    WxId: '', // 微信id
    Page: 0, // 页
    HasMore: false, //
    NextCursor: null // 上滑游标（/user/message/history）
  }, // 会话页面的会话列表

  content: '', // 当前要发送的内容， 默认为空
  remark: '', // 要@的群成员的id
  contentType: 'Text', // 当前要发送的消息类型，默认为文本
  url: '', // 大图的url
  hbDetailVisible: false, // 显示红包详情
  hbDetail: {
    WeChatId: '', // 所属微信号
    Success: false,
    ErrMsg: '',
    HbUrl: '', //
    TotalNum: null, // 红包总个数
    TotalAmount: null, // 红包总金额
    RecNum: null, // 已收红包个数
    Records: [], // 已收红包个数
    RecAmount: null // 已收红包金额
  }, // 红包详情
  // ============== ConversationTools用到的变量 =======
  userLabels: {}, // 标签
  // contactMessage: ['AcctId', 'Alias', 'Attr', 'Avatar', 'DepartIds', 'Gender', 'Name', 'RemoteId']

  // ============== 多选 / 引用 / 翻译 / 合并门闸 =======
  selectMode: false,
  selectedMsgs: [],
  quoteMsg: null,
  translations: {},
  supportsMergeForward: false,

  /** 置顶/免打扰乐观更新待确认：taskId → { WxId, RemoteId, isTop?, prevIsTop?, Notified?, prevNotified? } */
  pendingConvFlags: {},

  /** 已拉取的原图 URL 缓存（MsgId / MsgRemoteId → url），二次点开直接大图 */
  bigImageMap: {}
}

// getters
const getters = {
  // 当前账号绑定的微信列表 排序后的
  wechats: (state) => {
    let reWechats = []
    state.wechats.forEach((x) => {
      if (isWechatOnline(x)) {
        reWechats.push(x)
      }
    })
    state.wechats.forEach((x) => {
      if (!isWechatOnline(x)) {
        reWechats.push(x)
      }
    })
    return reWechats
  },
  // 当前账号绑定的微信昵称Map(id-nick)
  wechatsNameMap: (state, getters, rootState) => {
    const preferDevNick = Boolean(rootState.showDevNick)
    const wm = {}
    state.wechats.forEach((e) => {
      wm[e.WxId] = wechatDisplayName(e, preferDevNick) || e.Name
    })
    return wm
  },
  // 在线的微信
  wechatsOnline: (state) => {
    return state.wechats.filter((x) => isWechatOnline(x))
  },
  // 会话页面选择的微信
  currentWechat: (state) => state.currentWechat,
  //   会话页面选择的微信id
  currentWeChatId: (state) => {
    return state.currentWechat.WxId || ''
  },
  // 当前微信的会话：对齐 kelailaichatpc（置顶 > 时间 > 非好友沉底）
  // 按 conversations 数组引用缓存，避免每次选会话都全量 sort 卡第二下
  /** 全账号会话汇总（移动端「全部会话」） */
  allConversations: (state, getters) => {
    const conversList = []
    const convs = state.conversations || {}
    for (const key of Object.keys(convs)) {
      const list = convs[key]
      if (!Array.isArray(list) || !list.length) continue
      const wxKey = normalizeWxId(key)
      for (const conv of list) {
        conversList.push({
          ...conv,
          WeChatId: conv.WeChatId || conv.WxId || wxKey,
          WxId: conv.WxId || wxKey
        })
      }
    }
    if (!conversList.length) return []
    return sortConversationsForDisplay(conversList, getters.contactsMap)
  },
  currentConvs: (state, getters) => {
    const convKey = findMapKey(state.conversations, state.currentWechat.WxId)
    const list = state.conversations[convKey]
    if (!list) return []
    const contactsLen =
      (state.currentContacts && state.currentContacts.length) +
      (state.currentCustomers && state.currentCustomers.length)
    if (
      _sortedConvsCache.listRef === list &&
      _sortedConvsCache.wxKey === convKey &&
      _sortedConvsCache.contactsLen === contactsLen
    ) {
      return _sortedConvsCache.result
    }
    const result = sortConversationsForDisplay(list, getters.contactsMap)
    _sortedConvsCache = {
      listRef: list,
      wxKey: convKey,
      contactsLen,
      result
    }
    return result
  },
  // 每个设备的未读：仅在线号 + 非免打扰会话
  messagesNotRead(state) {
    const mnr = {}
    const onlineSet = new Set(
      (state.wechats || [])
        .filter((w) => w && isWechatOnline(w))
        .map((w) => normalizeWxId(w.WxId))
    )
    const convs = state.conversations
    for (const key in convs) {
      if (!Object.prototype.hasOwnProperty.call(convs, key)) continue
      const wxKey = normalizeWxId(key)
      if (!onlineSet.has(wxKey)) continue
      mnr[wxKey] = mnr[wxKey] || 0
      for (const conv of convs[key]) {
        if (shouldShowConversationUnreadBadge(conv)) {
          mnr[wxKey] += Number(conv.UnreadCnt) || 0
        }
      }
    }
    return mnr
  },
  // 当前微信的客户
  currentCustomers: (state) => {
    return state.currentCustomers
  },
  //   当前微信的企业联系人
  currentContacts: (state) => {
    return state.currentContacts
  },
  // remoteId对应的会话信息
  conversMap: (state, getters) => {
    let cm = {}
    getters.currentConvs.forEach((x) => {
      cm[normalizeId(x.RemoteId)] = x
    })
    return cm
  },
  // remoteId对应的好友信息
  contactsMap: (state, getters) => {
    let cm = {}
    getters.currentContacts.forEach((x) => {
      cm[normalizeId(x.RemoteId)] = x
    })
    getters.currentCustomers.forEach((x) => {
      cm[normalizeId(x.RemoteId)] = x
    })
    return cm
  },
  // 群成员联系状态: 'contact' | 'external' | 'stranger'
  // contact: 企业联系人或客户
  // external: 聊过但不是联系人
  // stranger: 从未联系过（消息摘要为"还不是联系人"）
  memberContactStatus: (state, getters) => (remoteId) => {
    const normalizedId = normalizeId(remoteId)
    if (getters.contactsMap[normalizedId]) {
      return 'contact'
    }
    // 不在 contactsMap 中，但可能在 allContactsNameMap 中（聊过但不是联系人）
    if (getters.allContactsNameMap && getters.allContactsNameMap[normalizedId]) {
      return 'external'
    }
    return 'stranger'
  },
  // 消息接收者对应的name
  allContactsNameMap: (state) => {
    let cm = {}
    state.allContacts.forEach((x) => {
      cm[x.RemoteId] = x.Name
    })
    state.allCustomers.forEach((x) => {
      cm[x.RemoteId] = x.Name
    })
    for (const key in state.conversations) {
      if (Object.hasOwnProperty.call(state.conversations, key)) {
        const wxConversations = state.conversations[key]
        wxConversations.forEach((x) => {
          cm[x.RemoteId] = x.Name
        })
      }
    }
    return cm
  },
  // 会话页面 每个微信的聊天对象
  currentFriends: (state) => state.currentFriends,
  // 当前微信的聊天对象
  currentFriend: (state, getters) => {
    const friendKey = findMapKey(state.currentFriends, getters.currentWeChatId)
    return state.currentFriends[friendKey] || {}
  },
  currentFriendId: (state, getters) => {
    return normalizeId(getters.currentFriend.RemoteId) || ''
  },
  // ============== ConversationFriends用到的变量 ====
  departments: (state) => state.departments,
  corporations: (state) => state.corporations,

  lastChatPages: (state) => state.lastChatPages,
  addressListPages: (state) => state.addressListPages,
  chatRoomPages: (state) => state.chatRoomPages,
  // ============== ConversationChats用到的变量 =======
  currentChats: (state) => state.currentChats,

  content: (state) => state.content,
  remark: (state) => state.remark,
  contentType: (state) => state.contentType,
  url: (state) => state.url,
  hbDetailVisible: (state) => state.hbDetailVisible,
  hbDetail: (state) => state.hbDetail,
  // 当前微信的客户标签
  currentLabels: (state, getters) => {
    let labels = state.userLabels
    let wxid = findMapKey(labels, getters.currentWeChatId)
    return labels[wxid] || []
  },
  selectMode: (state) => state.selectMode,
  selectedMsgs: (state) => state.selectedMsgs,
  quoteMsg: (state) => state.quoteMsg,
  translations: (state) => state.translations,
  supportsMergeForward: (state) => state.supportsMergeForward,
  bigImageMap: (state) => state.bigImageMap
}

/** HTTP 拉企微号列表去重：并发只发一次 */
let wechatsFetchInflight = null

// actions
const actions = {
  /**
   * HTTP 拉企微号列表写入 Vuex（首屏优先，不依赖 WS 连接就绪）。
   * WS GetWeChatsResp 仍会合并刷新在线状态。
   */
  FetchWechatsList({ state, commit, rootGetters, rootState }, { force = false } = {}) {
    if (!force && state.wechats && state.wechats.length > 0) {
      return Promise.resolve(state.wechats)
    }
    if (wechatsFetchInflight) return wechatsFetchInflight

    const user = rootGetters.currentUser || {}
    const admin = rootGetters.adminInfo || rootState.adminInfo || {}
    const accountId = resolvePcAccountId(
      user.UnionId ?? user.unionId ?? user.Id ?? user.id ?? admin.id ?? admin.Id
    )
    if (!accountId) {
      return Promise.resolve([])
    }

    wechatsFetchInflight = GetWeChatsReq(accountId)
      .then((res) => {
        if (res && res.code === 0 && Array.isArray(res.data)) {
          commit('SET_WECHATS', res.data)
        }
        return state.wechats
      })
      .catch((err) => {
        if (err && err.code === -1) {
          console.warn('[FetchWechatsList] 跳过：', err.msg)
        } else {
          console.warn('[FetchWechatsList] failed', err)
        }
        return state.wechats || []
      })
      .finally(() => {
        wechatsFetchInflight = null
      })

    return wechatsFetchInflight
  },
  /**
   * HTTP 拉服务端会话镜像写入 Vuex（分页）；不清空本地，避免刷新闪空。
   * @param {string|{wxId:string,maxRecords?:number}} payload
   * @returns {Promise<number>} 写入条数
   */
  async LoadConversationSnapshot({ commit }, payload) {
    const opts = typeof payload === 'string' ? { wxId: payload } : payload || {}
    const id = normalizeWxId(opts.wxId)
    if (!id) return 0
    const hardCap = Math.min(
      Math.max(Number(opts.maxRecords) || CONVERSATION_SNAPSHOT_DEFAULT_MAX, 1),
      500
    )
    let saved = 0
    let offset = 0
    try {
      while (offset < hardCap) {
        const limit = Math.min(CONVERSATION_SNAPSHOT_PAGE_SIZE, hardCap - offset)
        const res = await fetchConversationSnapshot({ wxId: id, limit, offset })
        if (!res || res.code !== 0 || !res.data) {
          if (isConversationSnapshotRateLimited(res)) {
            await sleepMs(CONVERSATION_SNAPSHOT_PAGE_DELAY_MS)
            continue
          }
          break
        }
        const records = Array.isArray(res.data.records) ? res.data.records : []
        if (records.length === 0) break

        const mapped = records.map((r) => mapSnapshotRecord(r, id))
        commit('SET_CONVERSATIONS', { WxId: id, Convers: mapped })
        saved += mapped.length

        const pageLimit = Number(res.data.limit) > 0 ? Number(res.data.limit) : limit
        const total = Number(res.data.total)
        if (
          saved >= hardCap ||
          (Number.isFinite(total) && total > 0 && offset + records.length >= total) ||
          records.length < pageLimit
        ) {
          break
        }
        offset += records.length
        await sleepMs(CONVERSATION_SNAPSHOT_PAGE_DELAY_MS)
      }
      return saved
    } catch (e) {
      console.warn('LoadConversationSnapshot failed', e)
      return saved
    }
  },
  // 更新会话列表（钉住/@我/问候不计未读）
  UpdateConversations: ({ state, commit, getters, dispatch }, talk) => {
    const wechatId = normalizeWxId(talk.WxId)
    const convKey = findMapKey(state.conversations, wechatId)
    const oldConvs = state.conversations
    const digest = getContent(talk)
    const viewingCurrent =
      sameWxId(wechatId, getters.currentWeChatId) &&
      sameId(talk.ConvId, getters.currentFriendId)
    let syncReadToPhone = null
    // 如果当前有数据
    if (oldConvs[convKey]) {
      const targetConvs = patchConversationList(
        oldConvs[convKey],
        (conv) => sameId(conv.RemoteId, talk.ConvId),
        (conv) => {
          const sentBySelf = sameId(talk.SenderId, talk.WxId)
          const myName = (state.currentWechat && state.currentWechat.Name) || ''
          const isAtMe =
            !sentBySelf &&
            detectAtMeInGroupTalk({ ...talk, PlainContent: digest }, myName)

          conv.UpdateTime = talk.CreateTime
          conv.MsgCnt = conv.MsgCnt ? conv.MsgCnt + 1 : 1

          if (talk.Members) {
            try {
              conv.DigestUser = base64.decode(talk.Content).split(':')[0]
            } catch (e) {
              /* ignore */
            }
          }

          if (sentBySelf) {
            conv.UnreadCnt = 0
            conv.AtCount = 0
            conv.ReadAt = Date.now()
            delete conv.UnreadBumpAt
            Object.assign(conv, clearAtMePinFields(conv))
            const localId =
              talk.ConvLocalId != null
                ? talk.ConvLocalId
                : conv.Id != null
                  ? conv.Id
                  : null
            if (localId != null && localId !== '') {
              syncReadToPhone = { WxId: wechatId, Id: localId, ConvId: localId }
            }
          } else if (
            talk.ContentType !== 'System' &&
            talk.ContentType !== 5 &&
            !isFriendAddGreetingDigest(digest)
          ) {
            if (viewingCurrent) {
              conv.UnreadCnt = 0
              conv.ReadAt = Date.now()
              delete conv.UnreadBumpAt
            } else {
              conv.UnreadCnt = (Number(conv.UnreadCnt) || 0) + 1
              conv.ReadAt = 0
              conv.UnreadBumpAt = Number(talk.CreateTime) || Date.now()
            }
          }

          if (isAtMe) {
            conv.AtCount = (Number(conv.AtCount) || 0) + 1
          }

          if (!isConversationDigestPinned(conv) && digest) {
            const nextDigest = isAtMe ? '[有人@你] ' + digest : digest
            conv.Digest = pickConversationDigest(nextDigest, conv.Digest)
          }

          const pin = buildPinnedDigest(talk, conv.Digest || digest, isAtMe)
          if (pin) Object.assign(conv, pin)
          return conv
        }
      )
      if (!targetConvs) {
        TriggerConversationPushTask(wechatId)
      } else {
        commit('UPDATE_CONVERSATIONS', { wechatId: wechatId, targetConvs: targetConvs })
        if (syncReadToPhone) {
          dispatch('websocket/TriggerMessageReadTask', syncReadToPhone, { root: true })
        }
      }
    } else {
      // 创建一个新的会话太麻烦 还是刷新会话列表吧
      TriggerConversationPushTask(wechatId)
    }
  },
  // 设置会话已读（RemoteId 优先；PostMessageReadNotice 仅带 ConvId/Id）
  SetConvReaded: ({ state, commit }, currentConv) => {
    const wechatId = normalizeWxId(currentConv.WxId)
    const convKey = findMapKey(state.conversations, wechatId)
    const oldConvs = state.conversations
    if (wechatId && oldConvs[convKey]) {
      const matchId = currentConv.RemoteId != null
        ? currentConv.RemoteId
        : (currentConv.ConvId != null ? currentConv.ConvId : currentConv.Id)
      const targetConvs = patchConversationList(
        oldConvs[convKey],
        (conv) =>
          currentConv.RemoteId != null
            ? sameId(conv.RemoteId, currentConv.RemoteId)
            : sameId(conv.Id, matchId),
        (conv) => {
          conv.UnreadCnt = 0
          conv.AtCount = 0
          conv.ReadAt = Date.now()
          delete conv.UnreadBumpAt
          return clearAtMePinFields(conv)
        }
      )
      if (targetConvs) {
        commit('UPDATE_CONVERSATIONS', { wechatId: wechatId, targetConvs: targetConvs })
      }
    }
  },
  // 设为未读（仅 PC 本地；企微栈无 TriggerUnReadTask）
  SetConvUnread: ({ state, commit }, currentConv) => {
    const wechatId = normalizeWxId(currentConv.WxId)
    const convKey = findMapKey(state.conversations, wechatId)
    const oldConvs = state.conversations
    if (wechatId && oldConvs[convKey]) {
      const targetConvs = patchConversationList(
        oldConvs[convKey],
        (conv) => sameId(conv.RemoteId, currentConv.RemoteId),
        (conv) => {
          conv.UnreadCnt = 1
          conv.ReadAt = 0
          return conv
        }
      )
      if (targetConvs) {
        commit('UPDATE_CONVERSATIONS', { wechatId: wechatId, targetConvs: targetConvs })
      }
    }
  },
  // 乐观更新置顶 / 免打扰（下发指令后立即反映到列表）
  PatchConversationFlags: ({ state, commit }, { WxId, RemoteId, isTop, Notified }) => {
    const wechatId = normalizeWxId(WxId)
    const convKey = findMapKey(state.conversations, wechatId)
    const oldConvs = state.conversations
    if (!wechatId || !oldConvs[convKey]) return
    const targetConvs = patchConversationList(
      oldConvs[convKey],
      (conv) => sameId(conv.RemoteId, RemoteId),
      (conv) => {
        if (isTop !== undefined) {
          conv.isTop = !!isTop
          conv.IsTop = !!isTop
        }
        if (Notified !== undefined) {
          conv.Notified = !!Notified
        }
        return conv
      }
    )
    if (targetConvs) {
      commit('UPDATE_CONVERSATIONS', { wechatId: wechatId, targetConvs: targetConvs })
    }
  },
  // 更新我的客户（全量推送：先清再写，避免重复；Contacts 缺省当空列表）
  UpdateCustomers({ getters, dispatch }, message) {
    const wxId = normalizeWxId(message.WxId || message.wxId)
    if (!wxId) return
    const raw = message.Contacts || message.contacts
    const Contacts = Array.isArray(raw) ? raw : []
    const Count = message.Count != null ? message.Count : message.count
    const buildRows = (prevDocs) => {
      const prevLabels = {}
      for (const d of prevDocs || []) {
        const rid = normalizeId(d.RemoteId != null ? d.RemoteId : d.remoteId)
        if (rid && Array.isArray(d.LabelIds) && d.LabelIds.length) {
          prevLabels[rid] = d.LabelIds
        }
      }
      return Contacts.map((x) => {
        const remoteId = normalizeId(x.RemoteId != null ? x.RemoteId : x.remoteId)
        const incoming = x.LabelIds
        const hasIncoming = Array.isArray(incoming) && incoming.length > 0
        return {
          ...x,
          WxId: wxId,
          Count,
          RemoteId: remoteId,
          LabelIds: hasIncoming ? incoming : prevLabels[remoteId] || incoming || []
        }
      })
    }
    const refreshUi = () => {
      if (sameWxId(wxId, getters.currentWeChatId)) {
        dispatch('SetCurrentCustomers', wxId)
      }
    }
    nedb.customers.find({ WxId: wxId }, (findErr, prevDocs) => {
      const rows = buildRows(findErr ? [] : prevDocs)
      // 分页推送（Page 从 0 起）：首页整表重置；后续页按 RemoteId 去重追加，避免多页互相冲掉
      const page = Number(message.Page != null ? message.Page : message.page) || 0
      const removeQuery =
        page > 0
          ? { WxId: wxId, RemoteId: { $in: rows.map((r) => r.RemoteId).filter(Boolean) } }
          : { WxId: wxId }
      nedb.customers.remove(removeQuery, { multi: true }, (err) => {
        if (err) return
        if (rows.length === 0) {
          refreshUi()
          return
        }
        nedb.customers.insert(rows, (insertErr) => {
          if (insertErr) return
          refreshUi()
        })
      })
    })
  },
  // 删除nedb中的指定微信的客户列表
  RemoveAllCustomersByWechatId({ dispatch }, wxid) {
    const id = normalizeWxId(wxid)
    nedb.customers.remove({ WxId: id }, { multi: true }, (err) => {
      if (err) return
      dispatch('SetCurrentCustomers', id)
    })
  },
  // 从nedb获取客户数据
  SetCurrentCustomers({ commit }, wxid) {
    const id = normalizeWxId(wxid)
    nedb.customers.find({ WxId: id }, (err, docs) => {
      if (err) {
        commit('SET_CURRENT_CUSTOMERS', [])
        return
      }
      commit('SET_CURRENT_CUSTOMERS', docs || [])
    })
  },

  // 更新或添加nedb中的customers数据
  UpdateFriend({ getters, dispatch, commit }, message) {
    const wxId = normalizeWxId(message.WxId)
    const { Info } = message
    if (!Info) return
    const remoteId = normalizeId(Info.RemoteId != null ? Info.RemoteId : Info.remoteId)
    const patch = { ...Info, WxId: wxId, RemoteId: remoteId }
    // 空 LabelIds 不覆盖本地已有（手机回包竞态/未带回标签时避免冲掉刚打上的标签）
    const incomingLabels = patch.LabelIds
    const hasIncomingLabels = Array.isArray(incomingLabels) && incomingLabels.length > 0
    if (!hasIncomingLabels) {
      delete patch.LabelIds
    }

    const applyToCurrentFriend = () => {
      if (!sameWxId(wxId, getters.currentWeChatId) || !sameId(remoteId, getters.currentFriendId)) return
      let { ...data } = getters.currentFriend
      for (const key in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
        data[key] = patch[key]
      }
      commit('UPDATE_CURRENT_FRIEND', { wxid: wxId, contact: data })
    }

    nedb.customers.update({ WxId: wxId, RemoteId: remoteId }, { $set: patch }, { upsert: false }, (err, num) => {
      if (!err && num) {
        if (sameWxId(wxId, getters.currentWeChatId)) {
          dispatch('SetCurrentCustomers', wxId)
        }
        applyToCurrentFriend()
        return
      }
      // RemoteId 类型不一致时再试原始值
      const rawId = Info.RemoteId
      if (rawId != null && String(rawId) !== String(remoteId)) {
        nedb.customers.update({ WxId: wxId, RemoteId: rawId }, { $set: patch }, { upsert: false }, (err2, num2) => {
          if (!err2 && num2 && sameWxId(wxId, getters.currentWeChatId)) {
            dispatch('SetCurrentCustomers', wxId)
          }
          applyToCurrentFriend()
        })
        return
      }
      applyToCurrentFriend()
    })
  },

  /** 本地持久化客户 LabelIds（打标乐观更新，防刷新丢失） */
  PatchCustomerLabelIds({ getters, dispatch, commit }, { wxId, remoteId, labelIds }) {
    const wx = normalizeWxId(wxId)
    const rid = normalizeId(remoteId)
    if (!wx || !rid) return
    const ids = Array.isArray(labelIds) ? labelIds : []
    nedb.customers.update({ WxId: wx, RemoteId: rid }, { $set: { LabelIds: ids } }, { upsert: false }, (err, num) => {
      if ((!num || err) && remoteId != null && String(remoteId) !== String(rid)) {
        nedb.customers.update({ WxId: wx, RemoteId: remoteId }, { $set: { LabelIds: ids } }, { upsert: false }, () => {
          if (sameWxId(wx, getters.currentWeChatId)) dispatch('SetCurrentCustomers', wx)
        })
        return
      }
      if (sameWxId(wx, getters.currentWeChatId)) dispatch('SetCurrentCustomers', wx)
    })
    if (sameWxId(wx, getters.currentWeChatId) && sameId(rid, getters.currentFriendId)) {
      commit('UPDATE_CURRENT_FRIEND', {
        wxid: wx,
        contact: { ...getters.currentFriend, LabelIds: ids, RemoteId: rid }
      })
    }
  },

  // 更新企业通讯录（全量推送：先清再写；Contacts 缺省当空列表）
  UpdateContacts({ getters, dispatch }, message) {
    const wxId = normalizeWxId(message.WxId || message.wxId)
    if (!wxId) return
    const raw = message.Contacts || message.contacts
    const Contacts = Array.isArray(raw) ? raw : []
    const Count = message.Count != null ? message.Count : message.count
    const rows = Contacts.map((x) => ({
      ...x,
      WxId: wxId,
      Count,
      RemoteId: normalizeId(x.RemoteId != null ? x.RemoteId : x.remoteId)
    }))
    const refreshUi = () => {
      if (sameWxId(wxId, getters.currentWeChatId)) {
        dispatch('SetCurrentContacts', wxId)
      }
    }
    // 分页推送（Page 从 0 起）：首页整表重置；后续页按 RemoteId 去重追加，避免多页互相冲掉
    const page = Number(message.Page != null ? message.Page : message.page) || 0
    const removeQuery =
      page > 0
        ? { WxId: wxId, RemoteId: { $in: rows.map((r) => r.RemoteId).filter(Boolean) } }
        : { WxId: wxId }
    nedb.contacts.remove(removeQuery, { multi: true }, (err) => {
      if (err) return
      if (rows.length === 0) {
        refreshUi()
        return
      }
      nedb.contacts.insert(rows, (insertErr) => {
        if (insertErr) return
        refreshUi()
      })
    })
  },
  // 删除nedb中的指定微信的企业联系人
  RemoveAllContactsByWechatId({ dispatch }, wxid) {
    const id = normalizeWxId(wxid)
    nedb.contacts.remove({ WxId: id }, { multi: true }, (err) => {
      if (err) return
      dispatch('SetCurrentContacts', id)
    })
  },
  // 从nedb获取企业联系人数据
  SetCurrentContacts({ commit }, wxid) {
    const id = normalizeWxId(wxid)
    nedb.contacts.find({ WxId: id }, (err, docs) => {
      if (err) {
        commit('SET_CURRENT_CONTACTS', [])
      } else {
        commit('SET_CURRENT_CONTACTS', docs || [])
      }
    })
  },
  // 设置所有的客户和联系人
  SetAllContacts({ commit }) {
    nedb.customers.find({}, (err, docs) => {
      if (err) return
      commit('SET_ALL_CUSTOMERS', docs || [])
    })
    nedb.contacts.find({}, (err, docs) => {
      if (err) return
      commit('SET_ALL_CONTACTS', docs || [])
    })
  },

  // FriendTalkNotice：当前会话 insert；非当前只落本地
  AddChats({ state, commit, getters, rootGetters }, talkNotice) {
    const userId = rootGetters.userId
    if (isMsgFieldDebugEnabled()) {
      logMsgFieldAnomaly('ws.add.raw', talkNotice, { source: 'FriendTalkNotice/TalkToFriendNotice' })
    }
    let notice = normalizeChatFields(normalizeSendFailChat(talkNotice))
    const wxId = notice.WxId
    const convId = notice.ConvId
    const isCurrent =
      sameWxId(wxId, state.currentChats.WxId) && sameId(convId, getters.currentFriendId)
    if (isCurrent && state.currentChats.Messages && state.currentChats.Messages.length) {
      notice = normalizeChatFields(
        enrichOutgoingNoticeFromLocalPreview(state.currentChats.Messages, notice)
      )
    }
    if (isMsgFieldDebugEnabled()) {
      logMsgFieldAnomaly('ws.add.normalized', notice, { source: 'after normalizeChatFields' })
    }
    if (shouldSkipEmptyIncomingChat(notice)) return
    // 加好友 System 问候不入库、不渲染（History/WS 可一次推十几条，会堵死主线程）
    if (friendAddGreetingFromChat(notice)) return
    if (isCurrent) {
      commit('UPDATE_CURRENT_CHATS_BY_TALK', notice)
    }
    persistIncomingRealtimeMessage(userId, wxId, convId, notice)
  },
  // 离线消息保存到chats
  AddChatsByHistory({ state, commit, getters, rootGetters }, hms) {
    const rawMessages = hms.Messages || hms.messages || []
    const wxId = normalizeWxId(hms.WxId || hms.wxId)
    const convId = normalizeId(
      hms.ConvId ||
        hms.convId ||
        (rawMessages[0] && (rawMessages[0].ConvId || rawMessages[0].convId))
    )

    if (!matchesCurrentChatSession(getters, wxId, convId)) {
      return
    }

    // History 洪水只取尾部再合并，避免一次塞入上千条卡死渲染
    const cappedIncoming = capMessagesTail(rawMessages, CURRENT_CHATS_SOFT_CAP)
      .map((m) => normalizeChatFields(normalizeSendFailChat(m)))
      .filter((m) => !friendAddGreetingFromChat(m))
    const normalizedHms = {
      ...hms,
      WxId: wxId,
      ConvId: convId,
      Messages: [...cappedIncoming],
      HasMore: hms.HasMore != null ? hms.HasMore : hms.hasMore
    }
    const flooded = rawMessages.length > cappedIncoming.length
    if (flooded) {
      normalizedHms.HasMore = true
    }

    const ccs = state.currentChats
    let nextMsgs
    let hasMore = normalizedHms.HasMore
    const belong = currentChatsBelongToSession(ccs, wxId, convId)
    if (belong && ccs.Messages && ccs.Messages.length > 0) {
      const merged = mergeDedupeAndSort(ccs.Messages, normalizedHms.Messages)
      const beforeCap = merged.length
      nextMsgs = capMessagesTail(merged, CURRENT_CHATS_SOFT_CAP)
      if (beforeCap > nextMsgs.length) hasMore = true
      commit('UPDATE_CURRENT_CHATS', { HasMore: hasMore, Messages: nextMsgs })
    } else {
      nextMsgs = [...(normalizedHms.Messages || [])]
      nextMsgs.sort(sortChatsAsc)
      nextMsgs = capMessagesTail(nextMsgs, CURRENT_CHATS_SOFT_CAP)
      commit('SET_CURRENT_CHATS', { ...normalizedHms, Messages: nextMsgs, HasMore: hasMore })
    }
    syncDigestFromMessages(state, commit, wxId, convId, nextMsgs)
    const userId = rootGetters.userId
    const snap = nextMsgs
    Promise.resolve()
      .then(() => {
        if (!matchesCurrentChatSession(getters, wxId, convId)) return
        return persistMessagesToLocalChats(userId, wxId, convId, snap)
      })
      .catch(() => {})
  },

  /**
   * 本地秒开（对齐 kelailaichatpc LoadLocalChatsForOpenSession）
   */
  async LoadLocalChatsForOpenSession(
    { state, commit, getters, rootGetters },
    { wxId, convId, limit = OPEN_SESSION_PAGE_SIZE, epoch = null } = {}
  ) {
    const userId = rootGetters.userId
    const w = normalizeWxId(wxId)
    const f = normalizeId(convId)
    if (!userId || !w || !f) return 0
    if (!matchesCurrentChatSession(getters, w, f)) return 0
    if (epoch != null && !isOpenSessionEpoch(epoch)) return 0

    const loadKey = `local|${userId}|${w}|${f}|${limit}`
    if (localChatLoadInflight.has(loadKey)) {
      return localChatLoadInflight.get(loadKey)
    }

    const task = (async () => {
      try {
        const local = await loadLocalChats(userId, w, f, limit)
        if (epoch != null && !isOpenSessionEpoch(epoch)) return 0
        if (!matchesCurrentChatSession(getters, w, f)) return 0
        if (!local.length) return 0
        const belong = currentChatsBelongToSession(state.currentChats, w, f)
        const existing = belong ? state.currentChats.Messages || [] : []
        const merged = capMessagesTail(
          mergeDedupeAndSort(existing, local.map((m) => normalizeChatFields(normalizeSendFailChat(m)))),
          CURRENT_CHATS_SOFT_CAP
        )
        if (belong && existing.length) {
          commit('UPDATE_CURRENT_CHATS', {
            Messages: merged,
            WxId: w,
            ConvId: f,
            Count: merged.length
          })
        } else {
          commit('SET_CURRENT_CHATS', {
            Count: merged.length,
            Messages: merged,
            Size: limit,
            ConvId: f,
            WxId: w,
            Page: 1,
            HasMore: false,
            NextCursor: null
          })
        }
        return merged.length
      } catch (e) {
        console.warn('[LoadLocalChatsForOpenSession] failed', e)
        return 0
      }
    })()

    localChatLoadInflight.set(loadKey, task)
    try {
      return await task
    } finally {
      if (localChatLoadInflight.get(loadKey) === task) {
        localChatLoadInflight.delete(loadKey)
      }
    }
  },

  /**
   * 打开会话：本地秒开 → HTTP 首屏（openSessionFast：有本地缓存也打 MySQL）
   * 对齐 kelailaichatpc scheduleOpenSessionHistoryLoad 的 store 侧契约。
   * 连点：bump 全局 epoch，旧打开在 await 后不再 commit/persist。
   */
  async OpenSessionChats({ state, commit, dispatch, getters, rootGetters }, { wxId, convId }) {
    const targetWxId = normalizeWxId(wxId)
    const targetConvId = normalizeId(convId)
    if (!targetWxId || !targetConvId) {
      return { ok: false, reason: 'missing-args' }
    }
    const epoch = bumpOpenSessionEpoch()
    const inflightKey = `open|${targetWxId}|${targetConvId}`
    const stillCurrent = () =>
      isOpenSessionEpoch(epoch) && matchesCurrentChatSession(getters, targetWxId, targetConvId)

    const job = (async () => {
      try {
        await dispatch('LoadLocalChatsForOpenSession', {
          wxId: targetWxId,
          convId: targetConvId,
          limit: OPEN_SESSION_PAGE_SIZE,
          epoch
        })
        if (!stillCurrent()) {
          return { ok: false, reason: 'aborted' }
        }
        const result = await dispatch('LoadChatsByHttp', {
          wxId: targetWxId,
          convId: targetConvId,
          rows: OPEN_SESSION_PAGE_SIZE,
          openSessionFast: true,
          epoch
        })
        if (!stillCurrent()) {
          return { ok: false, reason: 'aborted' }
        }
        // 秒开路径不落 IDB：避免「等第一下完成再点第二下」时 structuredClone/IDB 堵死
        return result
      } finally {
        if (openSessionInflight.get(inflightKey) === job) {
          openSessionInflight.delete(inflightKey)
        }
      }
    })()
    openSessionInflight.set(inflightKey, job)
    return job
  },

  /**
   * 通过 HTTP 直查生产库加载会话历史消息（替代依赖手机 SDK 推送的 HistoryMsgPushNotice）
   * <p>
   * 点击会话时由 ShowChats.watch.currentFriendId 调用，作为消息展示的主数据源；
   * WebSocket 的 FriendTalkNotice/TalkToFriendNotice 仍负责实时新消息追加。
   * 滚动加载更多时同样走此 action，按 page 递增并合并去重。
   * <p>
   * 返回值约定：{ ok: Boolean, reason: String }
   * <ul>
   *   <li>ok=true：加载成功（含"会话本身就没历史"的正常空态）</li>
   *   <li>ok=false, reason='missing-args'：UnionId/ConvId/WxId 缺失，通常是登录态未完整</li>
   *   <li>ok=false, reason='http-error'：网络异常/超时/接口 500</li>
   *   <li>ok=false, reason='aborted'：用户已切换到其他会话，本次结果被丢弃（正常静默）</li>
   *   <li>ok=false, reason='bad-response'：接口返回非 0 code 或结构不符（不弹提示，可能就是空态）</li>
   * </ul>
   *
   * @param {Object} payload
   * @param {String} payload.wxId 微信 id
   * @param {String} payload.convId 会话 RemoteId
   * @param {Number} [payload.page] 页码（从 1 开始）；不传则视为首次加载
   * @param {Number} [payload.rows] 每页条数，默认 20
   * @returns {Promise<{ok:Boolean, reason:String}>}
   */
  LoadChatsByHttp(
    { state, commit, getters, rootGetters },
    { wxId, convId, page, rows = 20, openSessionFast = false, epoch = null } = {}
  ) {
    const targetWxId = normalizeWxId(wxId)
    const targetConvId = normalizeId(convId)
    // UnionId 仅作登录态存在性校验，不参与查询参数；cid 由后端 JWT 解析
    if (!targetWxId || !targetConvId) {
      console.warn('LoadChatsByHttp 缺少必要参数', { wxId, convId })
      return Promise.resolve({ ok: false, reason: 'missing-args' })
    }
    if (epoch != null && !isOpenSessionEpoch(epoch)) {
      return Promise.resolve({ ok: false, reason: 'aborted' })
    }
    const pageNo = page || 1
    const userId = rootGetters.userId
    const inflightKey =
      pageNo === 1
        ? `http|${userId || ''}|${targetWxId}|${targetConvId}|${rows}|${openSessionFast ? 'fast' : 'std'}`
        : ''
    if (inflightKey && epoch == null && httpChatLoadInflight.has(inflightKey)) {
      return httpChatLoadInflight.get(inflightKey)
    }

    const task = queryChatHistory(targetWxId, targetConvId, '', pageNo, rows, '', '')
      .then((res) => {
        if (epoch != null && !isOpenSessionEpoch(epoch)) {
          return { ok: false, reason: 'aborted' }
        }
        // 响应体约定：{ code, data: { rows, records } }（见 tools/components/ChatHistory.vue）
        if (!res || res.code !== 0 || !res.data) {
          console.warn('LoadChatsByHttp 返回非成功', res)
          return { ok: false, reason: 'bad-response' }
        }
        // 切换会话期间若用户又切了别的会话，丢弃本次结果，避免串台
        if (!matchesCurrentChatSession(getters, targetWxId, targetConvId)) {
          return { ok: false, reason: 'aborted' }
        }
        const rawRows = Array.isArray(res.data.rows) ? res.data.rows : []
        const total = Number(res.data.records || 0)
        if (isMsgFieldDebugEnabled() && rawRows.length) {
          const sample = rawRows[0]
          logMsgFieldDebug('http.raw', {
            wxId: targetWxId,
            convId: targetConvId,
            pageNo,
            total,
            rowCount: rawRows.length,
            sampleKeys: Object.keys(sample || {}),
            sample: snapshotMsgFields(sample)
          })
        }
        const messages = rawRows.map((row) => mapHistoryRowToTalk(row, targetWxId, targetConvId))

        const hasMore = pageNo * rows < total
        // 分页加载，或首次加载时当前会话已有消息（如 WS History/实时刚追加）：合并去重，不丢弃已有消息。
        // HTTP 空结果禁止覆盖已有本地预览 / History / 实时消息。
        // openSessionFast：即使本地秒开已有消息也必须用 HTTP 校准（对齐 kelailai）
        const belong = currentChatsBelongToSession(state.currentChats, targetWxId, targetConvId)
        const existing = belong ? state.currentChats.Messages || [] : []
        if (messages.length === 0) {
          if (belong && existing.length > 0) {
            commit('UPDATE_CURRENT_CHATS', { HasMore: false })
            return { ok: true, reason: 'empty-keep' }
          }
          commit('SET_CURRENT_CHATS', {
            Count: 0,
            Messages: [],
            Size: rows,
            ConvId: targetConvId,
            WxId: targetWxId,
            Page: pageNo,
            HasMore: false,
            NextCursor: null
          })
          return { ok: true, reason: 'empty' }
        }
        if ((pageNo > 1 || (belong && existing.length > 0)) && existing.length > 0) {
          let merged = mergeDedupeAndSort(existing, messages)
          const cap = pageNo > 1 ? CURRENT_CHATS_SOFT_CAP * 3 : CURRENT_CHATS_SOFT_CAP
          const before = merged.length
          merged = capMessagesTail(merged, cap)
          commit('UPDATE_CURRENT_CHATS', {
            HasMore: hasMore || before > merged.length,
            Messages: merged,
            WxId: targetWxId,
            ConvId: targetConvId
          })
        } else {
          const sorted = capMessagesTail(mergeDedupeAndSort([], messages), CURRENT_CHATS_SOFT_CAP)
          commit('SET_CURRENT_CHATS', {
            Count: total,
            Messages: sorted,
            Size: rows,
            ConvId: targetConvId,
            WxId: targetWxId,
            Page: pageNo,
            HasMore: hasMore || messages.length > sorted.length,
            NextCursor: null
          })
        }
        if (epoch != null && !isOpenSessionEpoch(epoch)) {
          return { ok: false, reason: 'aborted' }
        }
        const chatsAfter = state.currentChats.Messages || messages
        // 打开会话秒开路径：禁止 Digest 重排侧栏 + 禁止立刻 IDB 持久化
        // （等第一下「落地」后再点第二下时，这两项最容易和 OpenSession 叠死主线程）
        if (!openSessionFast) {
          const digestWx = targetWxId
          const digestConv = targetConvId
          const digestSnap = chatsAfter
          setTimeout(() => {
            if (epoch != null && !isOpenSessionEpoch(epoch)) return
            if (!matchesCurrentChatSession(getters, digestWx, digestConv)) return
            syncDigestFromMessages(state, commit, digestWx, digestConv, digestSnap)
          }, 0)
          if (chatsAfter.length) {
            const snap = chatsAfter.slice()
            persistMessagesToLocalChats(userId, targetWxId, targetConvId, snap).catch(() => {})
          }
        }
        return { ok: true, reason: openSessionFast ? 'fast' : '' }
      })
      .catch((err) => {
        // 失败不清空已有消息，保留上一次的内容
        console.warn('LoadChatsByHttp 请求失败', err)
        return { ok: false, reason: 'http-error' }
      })
      .finally(() => {
        if (inflightKey && httpChatLoadInflight.get(inflightKey) === task) {
          httpChatLoadInflight.delete(inflightKey)
        }
      })

    if (inflightKey) {
      httpChatLoadInflight.set(inflightKey, task)
    }
    return task
  },

  /**
   * 上滑：HTTP 游标加载更早消息（不对手机发 TriggerHistory）
   * @returns {Promise<{ok:boolean, reason:string, hasMore?:boolean}>}
   */
  FetchOlderChatsByCursor({ state, commit, getters }, { wxId, convId, beforeTime, cursor, limit = 20 } = {}) {
    const targetWxId = normalizeWxId(wxId || getters.currentWeChatId)
    const targetConvId = normalizeId(convId || getters.currentFriendId)
    if (!targetWxId || !targetConvId) {
      return Promise.resolve({ ok: false, reason: 'missing-args' })
    }
    const useCursor = cursor || state.currentChats.NextCursor || null
    return fetchChatHistoryCursor({
      wxId: targetWxId,
      convId: targetConvId,
      beforeTime: useCursor ? undefined : beforeTime,
      cursor: useCursor || undefined,
      limit
    })
      .then((res) => {
        if (!res || res.code !== 0 || !res.data) {
          return { ok: false, reason: 'bad-response' }
        }
        if (!sameWxId(targetWxId, getters.currentWeChatId) || !sameId(targetConvId, getters.currentFriendId)) {
          return { ok: false, reason: 'aborted' }
        }
        const rawRows = Array.isArray(res.data.records) ? res.data.records : []
        const hasMore = !!res.data.has_more
        const nextCursor = res.data.next_cursor || null
        if (rawRows.length === 0) {
          commit('UPDATE_CURRENT_CHATS', { HasMore: false, NextCursor: null })
          return { ok: true, reason: '', hasMore: false }
        }
        const messages = rawRows.map((row) => mapHistoryRowToTalk(row, targetWxId, targetConvId))
        const existing = state.currentChats.Messages || []
        const merged = mergeDedupeAndSort(existing, messages)
        commit('UPDATE_CURRENT_CHATS', {
          HasMore: hasMore,
          NextCursor: nextCursor,
          Messages: merged
        })
        return { ok: true, reason: '', hasMore }
      })
      .catch((err) => {
        console.warn('FetchOlderChatsByCursor 失败', err)
        return { ok: false, reason: 'http-error' }
      })
  },

  /**
   * 按后端 coverage 空洞定向补拉（浏览区中间洞），最多 3 段。
   * 无空洞 / 接口未部署时静默 no-op。
   * @returns {Promise<{ok:boolean, reason:string, inserted?:number}>}
   */
  FillCoverageGaps({ state, commit, getters }, { wxId, convId, fromMs, toMs, limit = 20 } = {}) {
    const targetWxId = normalizeWxId(wxId || getters.currentWeChatId)
    const targetConvId = normalizeId(convId || getters.currentFriendId)
    let from = Number(fromMs) || 0
    let to = Number(toMs) || 0
    if ((!from || !to) && state.currentChats && Array.isArray(state.currentChats.Messages)) {
      for (const m of state.currentChats.Messages) {
        const t = normalizeMsgTimeMs(m && (m.MsgTime != null ? m.MsgTime : m.CreateTime))
        if (t <= 0) continue
        if (!from || t < from) from = t
        if (!to || t > to) to = t
      }
    }
    if (!targetWxId || !targetConvId || from <= 0 || to <= 0 || to < from) {
      return Promise.resolve({ ok: false, reason: 'missing-args' })
    }
    if (to - from < 1000) {
      return Promise.resolve({ ok: true, reason: 'no_gap', inserted: 0 })
    }

    return getChatHistoryCoverage({
      wxId: targetWxId,
      convId: targetConvId,
      fromMs: from,
      toMs: to
    })
      .then(async (res) => {
        if (!res || res.code !== 0 || !res.data) {
          return { ok: true, reason: 'coverage-unavailable', inserted: 0 }
        }
        if (!sameWxId(targetWxId, getters.currentWeChatId) || !sameId(targetConvId, getters.currentFriendId)) {
          return { ok: false, reason: 'aborted' }
        }
        const gaps = Array.isArray(res.data.gaps) ? res.data.gaps : []
        if (!gaps.length) {
          return { ok: true, reason: 'no_gap', inserted: 0 }
        }
        let inserted = 0
        const slice = gaps.slice(0, 3)
        for (const gap of slice) {
          if (!sameWxId(targetWxId, getters.currentWeChatId) || !sameId(targetConvId, getters.currentFriendId)) {
            return { ok: false, reason: 'aborted', inserted }
          }
          const beginMs = Number(gap.begin_ms != null ? gap.begin_ms : gap.beginMs) || 0
          const endMs = Number(gap.end_ms != null ? gap.end_ms : gap.endMs) || 0
          if (beginMs <= 0 || endMs < beginMs) continue
          let gapRes
          try {
            gapRes = await fetchCoverageGapMessages({
              wxId: targetWxId,
              convId: targetConvId,
              beginMs,
              endMs,
              limit
            })
          } catch (e) {
            console.warn('FillCoverageGaps gap 请求失败', e)
            continue
          }
          if (!gapRes || gapRes.code !== 0) continue
          const rawRows = Array.isArray(gapRes.data) ? gapRes.data : []
          if (!rawRows.length) continue
          const messages = rawRows.map((row) => mapHistoryRowToTalk(row, targetWxId, targetConvId))
          const existing = state.currentChats.Messages || []
          const beforeLen = existing.length
          const merged = mergeDedupeAndSort(existing, messages)
          inserted += Math.max(0, merged.length - beforeLen)
          commit('UPDATE_CURRENT_CHATS', { Messages: merged })
        }
        return { ok: true, reason: '', inserted }
      })
      .catch((err) => {
        console.warn('FillCoverageGaps 失败(忽略)', err)
        return { ok: true, reason: 'coverage-unavailable', inserted: 0 }
      })
  },

  // 更新当前好友的聊天记录
  InsertLocalChat: ({ getters, commit }, chat) => {
    const { WxId, ConvId } = chat
    if (sameWxId(WxId, getters.currentWeChatId) && sameId(ConvId, getters.currentFriendId)) {
      commit('INSERT_LOCAL_CHAT', chat)
    }
  },
  // 删除自己插入的数据
  RemoveLocalChat: ({ getters, commit }, chat) => {
    const { ConvId, WxId } = chat
    if (sameWxId(WxId, getters.currentWeChatId) && sameId(ConvId, getters.currentFriendId)) {
      commit('REMOVE_LOACL_CHAT', chat)
    }
  },
  // Result 成功：本地预览补 MsgId，先停转圈（内容等 Notice 再替换）
  ApplyTalkResultToLocal: ({ state, commit, rootGetters }, result) => {
    if (!result || !isTalkToFriendTaskResultSuccess(result)) return
    // 重发成功：删除 IDB 中的旧失败预览（仅有 TaskId），避免恢复出已取代的失败气泡
    const cc = state.currentChats
    if (cc && cc.WxId && cc.ConvId) {
      const userId = rootGetters.userId
      if (userId) deleteLocalChat(userId, cc.WxId, cc.ConvId, result).catch(() => {})
    }
    commit('APPLY_TALK_RESULT_TO_LOCAL', result)
  },
  /**
   * 私聊发图/发消息后手机回执慢：8s 后若仍转圈则进入 PendingSync 并轻量补洞。
   * 群聊必须等真实 Notice，不做假成功（对齐 kelailaichatpc ScheduleOutgoingAckFallback）。
   */
  ScheduleOutgoingAckFallback: ({ getters, commit, dispatch }, payload) => {
    if (!payload) return
    const friend = getters.currentFriend
    const isGroup = !!(friend && friend.Members && friend.Members.length)
    if (isGroup && payload.releaseSpinnerOnly !== true) return

    const messages = (getters.currentChats && getters.currentChats.Messages) || []
    let idx = findLocalPreviewIndex(messages, payload)
    if (idx < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (isLocalSendingChat(messages[i])) {
          idx = i
          break
        }
      }
    }
    if (idx < 0) return
    const cur = messages[idx]
    if (!cur || !cur.LocalSend) return

    const taskId = payload.TaskId != null ? payload.TaskId : cur.TaskId
    commit('MARK_LOCAL_SEND_PENDING_SYNC', { TaskId: taskId })
  },
  // Result 失败：本地预览 Status=5，停转圈，保留内容供红点重发
  MarkLocalSendFailed: ({ state, commit, rootGetters }, result) => {
    if (!result || isTalkToFriendTaskResultSuccess(result)) return
    commit('MARK_LOCAL_SEND_FAILED', result)
    // 持久化失败气泡到 IDB：刷新/重登后仍可恢复（红点重发）。只有 TaskId 也能稳定建 ID。
    const cc = state.currentChats
    if (!cc || !cc.WxId || !cc.ConvId) return
    const userId = rootGetters.userId
    if (!userId) return
    const failed = (cc.Messages || []).find(
      (m) => m && findLocalPreviewIndex([m], result) >= 0
    )
    if (failed) {
      persistMessagesToLocalChats(userId, cc.WxId, cc.ConvId, [failed]).catch(() => {})
    }
  },

  // 更新或添加nedb中的customers数据
  UpdateCustomersByLabel({ getters, dispatch, commit }, message) {
    let wxid = normalizeWxId(message.WxId)
    let id = message.AddUsers ? message.AddUsers[0] : message.DelUsers[0]
    // 如果有数据就更新 没有就插入
    nedb.customers.findOne({ WxId: wxid }, (err, doc) => {
      if (err) return
      if (doc) {
        // 老的数据
        let oldContacts = doc.Contacts
        let cc = {}
        for (const oc of oldContacts) {
          if (oc.RemoteId === id) {
            oc.LabelIds = message.LabelIds || []
            cc = oc
            break
          }
        }
        nedb.customers.update(
          { WxId: wxid },
          { $set: { Contacts: oldContacts } },
          { upsert: false },
          (err, numReplaced) => {
            if (err) return
            // 更新 contacts
            if (sameWxId(wxid, getters.currentWeChatId)) {
              dispatch('SetCurrentCustomers', wxid)
              let mm = {
                wxid: wxid,
                contact: cc
              }
              commit('SET_CURRENT_FRIENDS', mm)
            }
            // 更新当前的联系人(客户)
          }
        )
      }
    })
  },

  // 更新或添加nedb中的departments数据
  UpdateDepartments({ dispatch }, message) {
    if (message.WxId) {
      // 如果有数据就更新 没有就插入
      nedb.departments.update({ WxId: message.WxId }, message, { upsert: true }, (err, updateDoc) => {
        if (err) return
        dispatch('SetDepartments')
      })
    }
  },
  // 更新或添加nedb中的corporations数据
  UpdateCorporations({ commit, dispatch }, message) {
    if (message.WxId) {
      // 如果有数据就更新 没有就插入
      nedb.corporations.update({ WxId: message.WxId }, message, { upsert: true }, (err, updateDoc) => {
        if (err) return
        dispatch('SetCorporations')
      })
    }
  },
  // 设置departments
  SetDepartments({ commit }) {
    let departmentsMap = {}
    nedb.departments.find({}, (err, docs) => {
      if (err) return
      for (const doc of docs) {
        departmentsMap[doc.WxId] = {}
        if (doc.Departs) {
          for (const depart of doc.Departs) {
            departmentsMap[doc.WxId][depart.RemoteId] = depart.Name
            departmentsMap[doc.WxId][depart.ParentId] = depart.Name
          }
        }
      }
      if (JSON.stringify(departmentsMap) !== '{}') {
        commit('SET_DEPARTMENTS', departmentsMap)
      }
    })
  },
  // 设置corporations
  SetCorporations({ commit }) {
    let corpsMap = {}
    nedb.corporations.find({}, (err, docs) => {
      if (err) return
      for (const doc of docs) {
        if (doc.Corps) {
          for (const corp of doc.Corps) {
            corpsMap[corp.Id] = corp.Name
          }
        }
      }
      if (JSON.stringify(corpsMap) !== '{}') {
        commit('SET_CORPORATIONS', corpsMap)
      }
    })
  },

  // 群管理任务保存到数据库
  AddChatRoomTask({ rootGetters }, doc) {
    doc.userId = rootGetters.userId
    doc.result = 0 // 0表示初始状态 1表示成功 2表示失败
    nedb.chatRoomTask.insert(doc, (err, newDoc) => {
      if (err) return
    })
  },
  // 更新群管理任务
  UpdateChatRoomTask({ rootGetters, dispatch }, mj) {
    let flag = mj.Success ? 1 : 2
    nedb.chatRoomTask.update({ TaskId: mj.TaskId }, { $set: { result: flag } }, {}, (err, numReplaced) => { })
  },
  // 设置备注和标签操作 保存到数据库
  AddMemoTask({ rootGetters }, doc) {
    // doc.userId = rootGetters.userId
    doc.result = 0 // 0表示初始状态 1表示成功 2表示失败
    nedb.memoTask.insert(doc, (err, newDoc) => {
      if (err) return
    })
  },
  // 更新memoTask
  UpdateMemoTask({ rootGetters }, mj) {
    let flag = mj.Success ? 1 : 2 // 0初始状态, 1成功, 2失败
    nedb.memoTask.update({ TaskId: mj.TaskId }, { $set: { result: flag } }, {}, (err, numReplaced) => { })
  },
  UpdateBigImageMap({ commit }, { msgId, url, markOriginal }) {
    commit('UPDATE_BIG_IMAGE_MAP', { msgId, url, markOriginal })
  }
}

// mutations
const mutations = {
  SET_PENDING_CONV_FLAG: (state, payload) => {
    if (!payload || payload.taskId == null) return
    state.pendingConvFlags = {
      ...state.pendingConvFlags,
      [String(payload.taskId)]: payload
    }
  },
  CLEAR_PENDING_CONV_FLAG: (state, taskId) => {
    if (taskId == null) return
    const key = String(taskId)
    if (!state.pendingConvFlags[key]) return
    const next = { ...state.pendingConvFlags }
    delete next[key]
    state.pendingConvFlags = next
  },
  SET_WECHATS: (state, wechats) => {
    // GetWeChatsResp 可能是数组，或偶发包一层
    const list = Array.isArray(wechats)
      ? wechats
      : wechats && Array.isArray(wechats.WeChats)
        ? wechats.WeChats
        : wechats
    state.wechats = dedupeWechats(list)
  },

  // 设置当前选中的微信
  SET_CURRENT_WECHAT: (state, wechat) => {
    state.currentWechat = wechat
  },
  // 设置每个微信的会话（全量页推送合并去重）
  SET_CONVERSATIONS: (state, convsData) => {
    if (!convsData) return
    const wxId = normalizeWxId(convsData.WxId || convsData.wxId)
    const raw = convsData.Convers || convsData.convers
    if (!wxId || !Array.isArray(raw)) return
    const oldKey = findMapKey(state.conversations, wxId)
    if (oldKey !== wxId && state.conversations[oldKey]) {
      delete state.conversations[oldKey]
    }
    const map = {}
    const prevList = state.conversations[wxId] || []
    prevList.forEach((c) => {
      if (!c) return
      map[normalizeId(c.RemoteId)] = c
    })
    raw.forEach((x) => {
      const remoteId = normalizeId(x.RemoteId != null ? x.RemoteId : x.remoteId)
      const prev = map[remoteId]
      const incomingId = normalizeId(x.Id != null ? x.Id : x.id)
      const incoming = {
        ...x,
        WxId: wxId,
        RemoteId: remoteId,
        // 优先保留已有未失真的 LocalId（HTTP 快照常为字符串；WS 若带 number 可能已丢精度）
        Id: incomingId || (prev && prev.Id) || ''
      }
      if (prev) {
        const unreadCnt = mergeConversationUnreadCnt(incoming, prev)
        const top = mergeConversationTopFlag(incoming, prev)
        map[remoteId] = {
          ...prev,
          ...incoming,
          ...mergeConversationVisualFields(prev, incoming),
          Id: preferSafeConvLocalId(prev.Id, incoming.Id),
          Digest: pickConversationDigest(incoming.Digest, prev.Digest),
          UnreadCnt: unreadCnt,
          // proto3 省略 isTop=false；缺字段时保留本地乐观置顶，避免「置顶掉下来」
          isTop: top,
          IsTop: top,
          // 新未读清 ReadAt；已读保留，挡住陈旧快照回弹
          ReadAt: unreadCnt > 0 ? 0 : Number(prev.ReadAt) || 0
        }
      } else {
        map[remoteId] = enrichConversationVisualFields({
          ...incoming,
          Digest: pickConversationDigest(incoming.Digest, ''),
          UnreadCnt: Number(incoming.UnreadCnt) || 0
        })
      }
    })
    state.conversations[wxId] = Object.values(map)
  },
  // 删除指定微信的conversations
  DELETE_CONVERSATIONS: (state, wechatId) => {
    const wxId = normalizeWxId(wechatId)
    const key = findMapKey(state.conversations, wxId)
    state.conversations[key] = []
  },
  // 更新会话列表
  UPDATE_CONVERSATIONS: (state, newData) => {
    const wxId = normalizeWxId(newData.wechatId)
    const oldKey = findMapKey(state.conversations, wxId)
    if (oldKey !== wxId && state.conversations[oldKey]) {
      delete state.conversations[oldKey]
    }
    state.conversations[wxId] = newData.targetConvs
  },
  // 根据 change notice 更新会话列表（Id 可能是 string/number 混用，必须 sameId）
  CHANGE_CONVERSATIONS: (state, converData) => {
    let converInfo = converData.Convers
    if (!converInfo) return
    let wxid = normalizeWxId(converData.WxId)
    const convKey = findMapKey(state.conversations, wxid)

    if (state.conversations[convKey]) {
      for (const conv of state.conversations[convKey]) {
        const matched =
          (converInfo.RemoteId != null && sameId(conv.RemoteId, converInfo.RemoteId)) ||
          (converInfo.Id != null && sameId(conv.Id, converInfo.Id))
        if (!matched) continue

        conv.Digest = pickConversationDigest(converInfo.Digest, conv.Digest)
        conv.Members = converInfo.Members
        conv.Name = converInfo.Name
        conv.Notice = converInfo.Notice
        conv.HasExternMember = converInfo.HasExternMember
        conv.AvatarList = converInfo.AvatarList
        if (converInfo.UnreadCnt != null || converInfo.unreadCnt != null) {
          const nextUnread = mergeConversationUnreadCnt(converInfo, conv)
          conv.UnreadCnt = nextUnread
          conv.ReadAt = nextUnread > 0 ? 0 : Number(conv.ReadAt) || 0
        }
        if (converInfo.Notified != null) {
          conv.Notified = converInfo.Notified
        }
        if (converInfo.isTop != null || converInfo.IsTop != null) {
          const top = mergeConversationTopFlag(converInfo, conv)
          conv.isTop = top
          conv.IsTop = top
        }
        if (converInfo.isMarked != null || converInfo.IsMarked != null) {
          const marked = !!(converInfo.isMarked != null ? converInfo.isMarked : converInfo.IsMarked)
          conv.isMarked = marked
        }
        if (converInfo.UpdateTime) {
          conv.UpdateTime = converInfo.UpdateTime
        }

        const friendKey = findMapKey(state.currentFriends, wxid)
        if (state.currentFriends[friendKey] && sameId(state.currentFriends[friendKey].RemoteId, conv.RemoteId)) {
          state.currentFriends[wxid] = conv
          if (friendKey !== wxid) {
            delete state.currentFriends[friendKey]
          }
        }
        break
      }
    }
  },
  // 设置当前微信的联系人列表
  SET_CURRENT_CONTACTS(state, contactsDocs) {
    state.currentContacts = contactsDocs
  },
  // 设置当前微信的客户列表
  SET_CURRENT_CUSTOMERS(state, customersDocs) {
    state.currentCustomers = customersDocs
  },

  // 所有客户
  SET_ALL_CUSTOMERS(state, customersDocs) {
    state.allCustomers = customersDocs
  },
  // 所有联系人
  SET_ALL_CONTACTS(state, customersDocs) {
    state.allContacts = customersDocs
  },

  // 设置当前微信 所选的联系人|会话
  SET_CURRENT_FRIENDS: (state, msg) => {
    const wxid = normalizeWxId(msg.wxid)
    const oldKey = findMapKey(state.currentFriends, wxid)
    if (oldKey !== wxid && state.currentFriends[oldKey]) {
      delete state.currentFriends[oldKey]
    }
    state.currentFriends[wxid] = msg.contact
  },
  // 更新当前好友的信息
  UPDATE_CURRENT_FRIEND: (state, data) => {
    const wxid = normalizeWxId(data.wxid)
    const oldKey = findMapKey(state.currentFriends, wxid)
    if (oldKey !== wxid && state.currentFriends[oldKey]) {
      delete state.currentFriends[oldKey]
    }
    state.currentFriends[wxid] = data.contact
  },
  // 设置当前好友的聊天记录（Messages markRaw：避免深度 Proxy，第二下切会话时卡死主线程）
  SET_CURRENT_CHATS: (state, chatDocs) => {
    const msgs = chatDocs.Messages || []
    state.currentChats = {
      ...chatDocs,
      WxId: normalizeWxId(chatDocs.WxId),
      ConvId: normalizeId(chatDocs.ConvId),
      Messages: markRaw(msgs)
    }
  },
  // 更新当前好友的聊天记录
  UPDATE_CURRENT_CHATS: (state, docs) => {
    if (docs.Messages !== undefined) {
      state.currentChats.Messages = markRaw(docs.Messages || [])
    }
    if (docs.HasMore !== undefined) {
      state.currentChats.HasMore = docs.HasMore
    }
    if (docs.NextCursor !== undefined) {
      state.currentChats.NextCursor = docs.NextCursor
    }
  },
  // 更新当前好友的聊天记录（按 CreateTime 插入，避免陌生人 tip 被 append 到最底部）
  INSERT_LOCAL_CHAT: (state, doc) => {
    applySenderAccountFields(doc)
    const messages = state.currentChats.Messages || []
    state.currentChats.Messages = markRaw(insertChatSorted(messages, doc))
  },
  // 删除本地「发送中」预览（TaskId 或已补过的 MsgId/MsgRemoteId）
  REMOVE_LOACL_CHAT: (state, chat) => {
    const messages = state.currentChats.Messages
    if (!messages || !messages.length) return
    const fid = findLocalPreviewIndex(messages, chat)
    if (fid >= 0) {
      const next = messages.slice(0, fid).concat(messages.slice(fid + 1))
      state.currentChats.Messages = markRaw(next)
    }
  },
  // Result 成功：给本地预览写入 MsgId，清除转圈且不删气泡
  APPLY_TALK_RESULT_TO_LOCAL: (state, result) => {
    const messages = state.currentChats.Messages
    if (!messages || !messages.length) return
    const next = applyTalkResultToLocalMessages(messages, result)
    if (next !== messages) {
      state.currentChats.Messages = markRaw(next)
    }
  },
  // Result 失败：Status=5 + SendFailReason，停转圈保留内容
  MARK_LOCAL_SEND_FAILED: (state, result) => {
    const messages = state.currentChats.Messages
    if (!messages || !messages.length) return
    const next = markLocalSendFailedInMessages(messages, result)
    if (next !== messages) {
      state.currentChats.Messages = markRaw(next)
    }
  },
  // 8s 兜底：LocalSend → PendingSync，释放转圈
  MARK_LOCAL_SEND_PENDING_SYNC: (state, { TaskId }) => {
    const messages = state.currentChats.Messages
    if (!messages || !messages.length) return
    const next = markLocalPendingSyncInMessages(messages, { TaskId })
    if (next !== messages) {
      state.currentChats.Messages = markRaw(next)
    }
  },
  // 消息撤回成功更改本地数据
  UPDATE_CHAT: (state, message) => {
    const { WxId, MsgRemoteId, ConvId, Flag } = message
    let { Messages } = state.currentChats
    if (!Messages || !Messages.length) return
    let fid = Messages.findIndex((x) => {
      return sameWxId(x.WxId, WxId) && sameId(x.ConvId, ConvId) && sameId(x.MsgRemoteId, MsgRemoteId)
    })
    if (fid >= 0) {
      const next = Messages.slice()
      next[fid] = {
        ...Messages[fid],
        Flag: Flag,
        IsRevoke: true,
        isPreviousRevoked: true
      }
      state.currentChats.Messages = markRaw(next)
    }
  },
  // 更新当前会话的图片/视频详情（DownloadFileResultNotice）
  UPDATE_CHATS_BY_DETAIL: (state, detailDoc) => {
    if (!sameWxId(state.currentChats.WxId, detailDoc.WxId)) return
    const messages = state.currentChats.Messages || []
    if (!detailDoc.Url) {
      const failed = markMessageResourceFetchFailed(messages, detailDoc.MsgId)
      if (failed) state.currentChats.Messages = markRaw(failed)
      return
    }
    const url = String(detailDoc.Url).trim()
    const writeKey = (key) => {
      if (key != null && key !== '') state.bigImageMap[key] = url
    }
    // 先按 notice.MsgId 写 map（即使消息未命中，预览侧仍可凭 TaskId/waitingKey 换图）
    writeKey(detailDoc.MsgId)
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      // MsgId 可能是 number（WS）或 string（HTTP）；回包 MsgId 也可能对得上 MsgRemoteId
      if (
        !sameId(message.MsgId, detailDoc.MsgId) &&
        !sameId(message.MsgRemoteId, detailDoc.MsgId)
      ) {
        continue
      }
      const { content, ok } = applyDownloadUrlToMsgContent(message.Content, detailDoc.Url)
      const next = messages.slice()
      const { _resourceFetchError, __decodedHtml, ...rest } = message
      next[i] = ok
        ? { ...rest, Content: content, _originalImageReady: true }
        : { ...rest, _originalImageReady: true }
      state.currentChats.Messages = markRaw(next)
      writeKey(message.MsgId)
      writeKey(message.MsgRemoteId)
      break
    }
  },
  // 原图 URL 缓存（markOriginal=false 时仅写 map，不标 _originalImageReady）
  UPDATE_BIG_IMAGE_MAP: (state, { msgId, url, markOriginal }) => {
    if (!url) return
    const writeKey = (key, value) => {
      if (key != null && key !== '') state.bigImageMap[key] = value
    }
    const messages = state.currentChats.Messages || []
    const chat = messages.find(
      (c) => sameId(c.MsgId, msgId) || sameId(c.MsgRemoteId, msgId)
    )
    writeKey(msgId, url)
    if (chat) {
      writeKey(chat.MsgId, url)
      writeKey(chat.MsgRemoteId, url)
      if (markOriginal !== false) {
        const idx = messages.indexOf(chat)
        if (idx >= 0) {
          const next = messages.slice()
          next[idx] = { ...chat, _originalImageReady: true }
          state.currentChats.Messages = markRaw(next)
        }
      }
    }
  },
  // 重置聊天记录
  RESET_CURRENT_CHATS: (state, payload) => {
    const wxId = normalizeWxId(typeof payload === 'object' ? payload.wxId : payload)
    const convId = normalizeId(typeof payload === 'object' ? payload.convId : '')
    state.currentChats = {
      Count: 0,
      Messages: markRaw([]),
      Size: 0,
      ConvId: convId,
      WxId: wxId || '',
      Page: 0,
      HasMore: false,
      NextCursor: null
    }
  },
  // 通过聊天通知 更新当前好友的聊天记录
  UPDATE_CURRENT_CHATS_BY_TALK: (state, doc) => {
    applySenderAccountFields(doc)
    const wxId = normalizeWxId(doc.WxId)
    const convId = normalizeId(doc.ConvId)
    const friendKey = findMapKey(state.currentFriends, wxId)
    let currentConv = state.currentFriends[friendKey] || {}
    const sessionConvId = normalizeId(state.currentChats.ConvId)
    if (
      sameId(convId, currentConv.RemoteId) ||
      sameId(convId, sessionConvId)
    ) {
      const messages = state.currentChats.Messages || []
      // 单条快路径：merge/二分插入，勿全表 dedupe+sort（系统消息突发 60 条/秒时主线程尖峰，
      // 对齐 kelailaichatpc UPDATE_CURRENT_CHATS）；cleanup 语义由 appendIncomingChat 内部闸门保证
      const next = appendIncomingChat(messages, doc)
      state.currentChats.Messages = markRaw(next)
      state.currentChats.Count = next.length
      bus.emit('setScrollBottom')
    }
  },

  // 删除已经退出群聊的群聊会话
  DELETE_CONV(state, message) {
    const wechatId = message.WeChatId
    const oldConvs = state.conversations[wechatId]
    // 如果当前有数据
    if (oldConvs) {
      for (let index = 0; index < oldConvs.length; index++) {
        const element = oldConvs[index]
        if (element.UserName === message.RoomId) {
          oldConvs.splice(index, 1)
          break
        }
      }
      state.conversations[message.WeChatId] = oldConvs
    }
  },
  // 设置所有的公司列表（假设公司的id是唯一的）
  SET_CORPORATIONS(state, corpsMap) {
    state.corporations = corpsMap
  },
  // 设置企业联系人的部门列表
  SET_DEPARTMENTS(state, departsMap) {
    state.departments = departsMap
  },

  // 设置当前会话的当前页
  SET_LAST_CHAT_PAGES: (state, msg) => {
    state.lastChatPages[msg.wechatId] = msg.page
  },
  // 设置通讯录的当前页
  SET_ADDRESS_LIST_PAGES: (state, msg) => {
    state.addressListPages[msg.wechatId] = msg.page
  },
  // 设置群聊的当前页
  SET_CHAT_ROOM_PAGES: (state, msg) => {
    state.chatRoomPages[msg.wechatId] = msg.page
  },

  // 设置消息内容
  SET_CONTENT: (state, content) => {
    state.content = content
  },
  SET_REMARK: (state, remark) => {
    state.remark = remark
  },
  // 设置消息类型
  SET_CONTENT_TYPE: (state, type) => {
    state.contentType = type
  },
  SET_SELECT_MODE: (state, on) => {
    state.selectMode = !!on
    if (!on) state.selectedMsgs = []
  },
  TOGGLE_SELECTED_MSG: (state, chat) => {
    if (!chat) return
    const id = chat.MsgRemoteId || chat.MsgId
    const i = state.selectedMsgs.findIndex((c) => (c.MsgRemoteId || c.MsgId) === id)
    if (i >= 0) state.selectedMsgs.splice(i, 1)
    else state.selectedMsgs.push(chat)
  },
  CLEAR_SELECTED_MSGS: (state) => {
    state.selectedMsgs = []
  },
  SET_QUOTE_MSG: (state, chat) => {
    state.quoteMsg = chat || null
  },
  CLEAR_QUOTE_MSG: (state) => {
    state.quoteMsg = null
  },
  SET_TRANSLATION: (state, { key, text, loading, error }) => {
    if (!key) return
    state.translations[key] = {
      text: text || '',
      loading: !!loading,
      error: error || ''
    }
  },
  SET_SUPPORTS_MERGE_FORWARD: (state, v) => {
    state.supportsMergeForward = !!v
  },
  // 设置大图/视频 的url
  SET_URL: (state, url) => {
    state.url = url
  },
  // 设置显示红包详情
  SET_HB_DETAIL_VISIBLE: (state, visible) => {
    state.hbDetailVisible = visible
  },
  // 设置显示红包详情
  SET_HB_DETAIL: (state, hbdetail) => {
    for (const key in hbdetail) {
      if (hbdetail.hasOwnProperty(key)) {
        state.hbDetail[key] = hbdetail[key]
      }
    }
  },
  // 设置userLabels
  UPDATE_USER_LABELS: (state, labelsDocs) => {
    const wxId = normalizeWxId(labelsDocs.WxId)
    const oldKey = findMapKey(state.userLabels, wxId)
    if (oldKey !== wxId && state.userLabels[oldKey]) {
      delete state.userLabels[oldKey]
    }
    state.userLabels[wxId] = labelsDocs.LabelGroups || []
  },

  // 微信下线
  WECHAT_OFF_LINE: (state, wechatId) => {
    const id = normalizeWxId(wechatId)
    for (const wechat of state.wechats) {
      if (normalizeWxId(wechat.WxId) === id) {
        wechat.isonline = ISONLINE_OFFLINE
        // 更新当前微信信息
        if (id === normalizeWxId(state.currentWechat.WxId)) {
          state.currentWechat = wechat
        }
        break
      }
    }
  },
  // 微信上线
  WECHAT_ON_LINE: (state, rawWechatInfo) => {
    const wechatInfo = normalizeWechatRecord({ ...rawWechatInfo, isonline: ISONLINE_ONLINE })
    if (!wechatInfo) return

    wechatInfo.isonline = ISONLINE_ONLINE
    const flagIndex = findWechatIndex(state.wechats, wechatInfo)
    if (flagIndex >= 0) {
      state.wechats.splice(
        flagIndex,
        1,
        mergeWechatRecord(state.wechats[flagIndex], { ...wechatInfo, isonline: ISONLINE_ONLINE })
      )
    } else {
      state.wechats.push(wechatInfo)
    }

    // 更新当前微信信息
    if (normalizeWxId(wechatInfo.WxId) === normalizeWxId(state.currentWechat.WxId)) {
      const currentIndex = flagIndex >= 0 ? flagIndex : state.wechats.length - 1
      state.currentWechat = state.wechats[currentIndex]
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
