import nedb from '../../db/nedb'

// state
const state = {
  addFriendsHistory: [], // 添加好友的列表
  newFriends: {
    WxId: '',
    Contacts: []
  }, // 新的朋友
  qrCode: {}, // 微信二维码
  wxFriends: {
    Count: 0,
    Friends: [],
    WxId: ''
  }, // 微信好友
  phoneState: {}, // 手机状态
  recentOneWay: {} // wxId -> remoteId[]
}

// getters
const getters = {
  addFriendsHistory: (state) => state.addFriendsHistory,
  newFriends: (state) => state.newFriends.Contacts,
  qrCode: (state) => state.qrCode,
  wxFriends: (state) => state.wxFriends,
  phoneState: (state) => state.phoneState,
  recentOneWay: (state) => state.recentOneWay
}

// actions
const actions = {
  // 更新或添加nedb中的 addCustomerFromSearchTask 数据
  UpdateAddCustomerFromSearchTask({ dispatch }, message) {
    let taskId = Number(message.TaskId)
    // 查数据库有没有记录
    nedb.addCustomerFromSearchTask.findOne({ TaskId: taskId }, (err, doc) => {
      if (err) return
      if (doc) {
        nedb.addCustomerFromSearchTask.update(
          { TaskId: taskId },
          { $set: { result: message.result } },
          {},
          (err, numReplaced) => {
            if (err) return
            dispatch('SetAddCustomerFromSearchTask', message.WxId)
          }
        )
      } else {
        nedb.addCustomerFromSearchTask.insert(message, (err, newDoc) => {
          if (err) return
          dispatch('SetAddCustomerFromSearchTask', message.WxId)
        })
      }
    })
  },
  // 从nedb获取 addCustomerFromSearchTask 数据
  SetAddCustomerFromSearchTask({ rootGetters, commit }, wxid) {
    nedb.addCustomerFromSearchTask
      .find({ userId: rootGetters.userId, WxId: wxid }) // 全部
      .sort({ TaskId: -1 }) // 降序
      // .limit(20) // 20条
      .exec((err, docs) => {
        if (!err && docs) {
          commit('SET_ADD_CUSTOMER_FROM_SEARCH_TASK', docs)
        }
      })
  }
}

// mutations
const mutations = {
  // 设置加好友历史记录
  SET_ADD_CUSTOMER_FROM_SEARCH_TASK(state, docs) {
    state.addFriendsHistory = docs
  },
  // 设置工具大全的微信二维码
  UPDATE_QR_CODE(state, doc) {
    if (doc.Success) {
      state.qrCode[doc.WxId] = doc.Url
    }
  },
  // 设置微信好友（手机端分页推送，Page 从 0 起；同一次同步需追加合并）
  SET_WX_FRIENDS(state, message) {
    if (!message) return
    const incoming = Array.isArray(message.Friends) ? message.Friends : []
    const page = Number(message.Page) || 0
    const count = message.Count != null ? Number(message.Count) : 0
    const wxId = message.WxId
    const taskId = message.TaskId

    // 首页：整表重置
    if (page === 0) {
      state.wxFriends = {
        Count: count,
        Friends: incoming.slice(),
        WxId: wxId,
        Page: page,
        Size: message.Size,
        TaskId: taskId
      }
      return
    }

    // 非首页：必须同号、同任务且已有数据，否则丢弃（避免重拉后旧页污染）
    const sameWx = state.wxFriends && String(state.wxFriends.WxId) === String(wxId)
    const sameTask =
      taskId == null ||
      state.wxFriends.TaskId == null ||
      String(state.wxFriends.TaskId) === String(taskId)
    if (!sameWx || !sameTask || !(state.wxFriends.Friends && state.wxFriends.Friends.length)) {
      return
    }

    const existing = state.wxFriends.Friends || []
    const seen = new Set(existing.map((f) => f && f.OpenId).filter(Boolean))
    const merged = existing.slice()
    for (const f of incoming) {
      if (!f) continue
      if (f.OpenId && seen.has(f.OpenId)) continue
      if (f.OpenId) seen.add(f.OpenId)
      merged.push(f)
    }
    state.wxFriends = {
      ...state.wxFriends,
      Count: count || merged.length,
      Friends: merged,
      Page: page,
      Size: message.Size,
      TaskId: taskId != null ? taskId : state.wxFriends.TaskId
    }
  },
  // 重置微信好友
  RESET_WX_FRIENDS(state) {
    state.wxFriends = { Count: 0, Friends: [], WxId: '' }
  },
  // 重置新的朋友
  RESET_NEW_FRIENDS(state) {
    state.newFriends.WxId = ''
    state.newFriends.Contacts = []
  },
  // 设置新的朋友
  SET_NEW_FRIENDS(state, data) {
    console.log('SET_NEW_FRIENDS', data)
    state.newFriends.WxId = data.WxId
    state.newFriends.Contacts = data.Contacts || []
  },
  // 更细本地 newFriends 数据（通过好友验证后移除对应项）
  UPDATE_NEW_FRIENDS(state, taskResult) {
    if (!taskResult) return
    if (state.newFriends.WxId === taskResult.WxId && taskResult.Success) {
      const taskId = taskResult.TaskId != null ? String(taskResult.TaskId) : ''
      state.newFriends.Contacts = state.newFriends.Contacts.filter(
        (x) => String(x.RemoteId) !== taskId
      )
    }
  },
  // 设置手机状态
  SET_PHONE_STATE: (state, data) => {
    state.phoneState[data.WxId] = data
  },
  // 单向客户上报（清粉页）
  APPEND_RECENT_ONE_WAY(state, { wxId, ids }) {
    if (!wxId || !ids || !ids.length) return
    const prev = state.recentOneWay[wxId] || []
    const set = new Set(prev)
    ids.forEach((id) => {
      if (id != null && id !== '') set.add(String(id))
    })
    state.recentOneWay[wxId] = Array.from(set)
  },
  CLEAR_RECENT_ONE_WAY(state, wxId) {
    if (!wxId) return
    state.recentOneWay[wxId] = []
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
