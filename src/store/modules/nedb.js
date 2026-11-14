import nedb from '../../db/nedb'
import { GetClaimedLuckyMoneyKeys, GetRefundedTransferKeys } from '@/api/httpApi'

// state
const state = {
  luckMoneyMap: {}, // 红包账单 MsgRemoteId / msgkey_*
  refundedTransferKeys: {} // `${wxId}:${msgKey}` → true
}

// getters
const getters = {
  luckMoneyMap: (state) => state.luckMoneyMap,
  refundedTransferKeys: (state) => state.refundedTransferKeys
}

// actions
const actions = {
  AddLabel({ dispatch }, message) {
    let label = message.Label
    let wechatId = message.WeChatId
    let newLable = {
      LabelId: label.LabelId,
      LabelName: label.LabelName
    }
    nedb.labels.findOne({ WeChatId: wechatId }, (err, doc) => {
      if (err) return
      let newDoc = {
        Labels: [newLable],
        WeChatId: wechatId
      }
      if (doc) {
        let labels = doc.Labels
        let flag = true
        for (const label of labels) {
          if (label.LabelId === newLable.LabelId) {
            label.LabelName = newLable.LabelName
            flag = false
            break
          }
        }
        if (flag) {
          labels.push(newLable)
        }
        newDoc.Labels = labels
      }
      dispatch('UpdateOrAddLabels', newDoc)
    })
  },
  DeleteLabel({ dispatch }, message) {
    let wechatId = message.WeChatId
    nedb.labels.findOne({ WeChatId: wechatId }, (err, doc) => {
      if (err) return
      if (doc) {
        let newLables = []
        for (const label of doc.Labels) {
          if (label.LabelId !== message.LabelId) {
            newLables.push(label)
          }
        }
        let newDoc = {
          Labels: newLables,
          WeChatId: wechatId
        }
        dispatch('UpdateOrAddLabels', newDoc)
      }
    })
  },
  SetLabels({ commit }, wechatId) {
    nedb.labels.findOne({ WeChatId: wechatId }, (err, doc) => {
      if (err) return
      if (doc) {
        commit('SET_LABELS', doc)
      }
    })
  },
  UpdateOrAddLabels({ rootGetters, dispatch }, message) {
    let wechatId = message.WeChatId
    nedb.labels.update({ WeChatId: message.WeChatId }, message, { upsert: true }, (err, numReplaced) => {
      if (err) return
      dispatch('SetLabels', wechatId)
    })
  },

  SetLuckMoneyMap({ rootGetters, commit }) {
    nedb.luckMoney.find({ userId: rootGetters.userId }, (err, docs) => {
      if (err) return
      commit('SET_LUCK_MONEY_MAP', docs)
    })
  },
  InsertLuckMoney({ rootGetters, dispatch }, doc) {
    doc.userId = rootGetters.userId
    doc.opened = false
    if (doc.WxId && !doc.WeChatId) doc.WeChatId = doc.WxId
    nedb.luckMoney.insert(doc, (err, newDoc) => {
      if (err) return
      dispatch('SetLuckMoneyMap')
    })
  },
  UpdateLuckMoney({ rootGetters, rootState, dispatch }, message) {
    const wxId = message.WxId || message.WeChatId || message.wechatId
    const msgKey = message.MsgKey || message.msgKey
    if (!msgKey) return
    let MsgRemoteId = message.MsgRemoteId || message.MsgSvrId
    const chats = rootState.conversation?.currentChats?.Messages || []
    if (!MsgRemoteId && chats.length) {
      const chat = chats.find((c) => {
        try {
          let content = c.Content
          if (typeof content !== 'string') return false
          if (c.ConvId && thisIsGroupContent(content)) {
            content = content.replace(/\S+?:/, '').replace(/^\n+|\n+$/g, '')
          }
          if (!/^\{/.test(content.trim())) return false
          const parsed = JSON.parse(content.replace(/^\S+?:/, '').replace(/^\n+|\n+$/g, '') || content)
          return (
            parsed &&
            (parsed.Key === msgKey ||
              parsed.MsgKey === msgKey ||
              (typeof msgKey === 'string' && parsed.Key && msgKey.indexOf(parsed.Key) >= 0))
          )
        } catch (_) {
          return false
        }
      })
      if (chat) MsgRemoteId = chat.MsgRemoteId || chat.MsgSvrId
    }
    const updateFields = {
      opened: true,
      Amount: message.Amount,
      RecTime: message.RecTime || Date.now()
    }
    if (MsgRemoteId) updateFields.MsgRemoteId = MsgRemoteId
    nedb.luckMoney.update(
      {
        userId: rootGetters.userId,
        MsgKey: msgKey,
        WeChatId: wxId
      },
      { $set: updateFields },
      { upsert: true },
      (err) => {
        if (err) return
        dispatch('SetLuckMoneyMap')
      }
    )
  },
  /** 切号/登录时拉 claimedKeys + refundedKeys（后端未就绪则静默失败） */
  async SyncBackendLuckMoneyRefundState({ commit, dispatch }, payload) {
    const wxId =
      typeof payload === 'string' || typeof payload === 'number'
        ? payload
        : payload && (payload.wxId || payload.wechatId)
    if (!wxId) return
    try {
      const [claimedRes, refundedRes] = await Promise.all([
        GetClaimedLuckyMoneyKeys(wxId).catch(() => null),
        GetRefundedTransferKeys(wxId).catch(() => null)
      ])
      const claimed =
        (claimedRes && claimedRes.data && (claimedRes.data.keys || claimedRes.data.claimed || claimedRes.data)) ||
        []
      if (Array.isArray(claimed)) {
        for (const item of claimed) {
          const key = typeof item === 'string' ? item : item && (item.MsgKey || item.msgKey || item.key)
          if (!key) continue
          const amount = typeof item === 'object' ? Number(item.Amount != null ? item.Amount : item.amount) : 0
          const type = typeof item === 'object' ? Number(item.Type != null ? item.Type : item.type) : 0
          // 红包金额为0：历史假成功记录，不同步成「已领取」
          if ((!Number.isFinite(type) || type === 0) && (!(Number.isFinite(amount)) || amount <= 0)) {
            continue
          }
          await new Promise((resolve) => {
            dispatch('UpdateLuckMoney', {
              WxId: wxId,
              WeChatId: wxId,
              MsgKey: key,
              Amount: amount || 0,
              RecTime: (item && item.RecTime) || Date.now()
            })
            resolve()
          })
        }
      }
      const refunded =
        (refundedRes &&
          refundedRes.data &&
          (refundedRes.data.keys || refundedRes.data.refunded || refundedRes.data)) ||
        []
      if (Array.isArray(refunded)) {
        for (const item of refunded) {
          const key = typeof item === 'string' ? item : item && (item.MsgKey || item.msgKey || item.key)
          if (key) commit('ADD_REFUNDED_TRANSFER', { wxId, msgKey: key })
        }
      }
    } catch (_) {
      /* stub / offline */
    }
  }
}

function thisIsGroupContent(content) {
  return typeof content === 'string' && /^\S+:\s*\{/.test(content)
}

// mutations
const mutations = {
  SET_LABELS(state, doc) {
    state.labels = doc.Labels
  },
  SET_LUCK_MONEY_MAP(state, docs) {
    const newMap = {}
    for (const key in docs) {
      const doc = docs[key]
      if (!doc) continue
      if (doc.MsgRemoteId) newMap[String(doc.MsgRemoteId)] = doc
      if (doc.MsgSvrId) newMap[String(doc.MsgSvrId)] = doc
      if (doc.MsgKey) newMap['msgkey_' + doc.MsgKey] = doc
    }
    state.luckMoneyMap = newMap
  },
  ADD_REFUNDED_TRANSFER(state, { wxId, wechatId, msgKey }) {
    const id = wxId || wechatId
    if (!id || !msgKey) return
    state.refundedTransferKeys = { ...state.refundedTransferKeys, [`${id}:${msgKey}`]: true }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
