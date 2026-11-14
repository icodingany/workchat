import nedb from '../../db/nedb'
import base64 from '@/utils/base64'

// state
const state = {
  logs: [] // 日志
}

// getters
const getters = {
  logs: (state) => state.logs
}

// actions
const actions = {
  // 将群发的任务保存到数据库
  AddGroupSendTask2Nedb({ rootGetters, dispatch }, doc) {
    doc.userId = rootGetters.userId
    doc.result = 0
    let groupLogWeChatId = rootGetters['conversation/currentWeChatId']
    nedb.groupSendTask.insert(doc, (err, newDoc) => {
      if (err) return
      if (doc.WeChatId === groupLogWeChatId) {
        dispatch('SetGroupSendLog', doc.WeChatId)
      }
    })
  },
  // 更新群发日志
  UpdateGroupSendTask({ rootGetters, dispatch, commit }, mj) {
    let taskId = mj.TaskId
    let flag = mj.Success ? 1 : 2
    let wechatId = mj.WeChatId
    let groupLogWeChatId = rootGetters['conversation/currentWeChatId']
    nedb.groupSendTask.update({ TaskId: taskId }, { $set: { result: flag } }, {}, (err, numReplaced) => {
      if (err) return
      if (wechatId === groupLogWeChatId) {
        dispatch('SetGroupSendLog', wechatId)
      }
    })
  },
  // 查询群发的日志
  SetGroupSendLog({ commit, rootGetters }, wechatId) {
    nedb.groupSendTask.find({ userId: rootGetters.userId, WeChatId: wechatId }, (err, docs) => {
      if (err) return
      commit('SET_LOGS', docs)
    })
  }
}

// mutations
const mutations = {
  // 群发助手页面所选微信的群发日志
  SET_LOGS(state, docs) {
    // docs.sort((a, b) => {
    //     return b.TaskId - a.TaskId
    // })
    state.logs = docs
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
