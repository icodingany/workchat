// state
const state = {
  circles: {
    SnsList: [],
    WxId: '',
    NextSeq: '',
    Success: null
  }, // 朋友圈
  // replace: 首次/刷新整表替换；append: 「获取更多」分页追加
  pullMode: 'replace'
}

// getters
const getters = {
  circles: (state) => state.circles
}

function sameId(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false
  return String(a) === String(b)
}

function dedupeAppend(existing, incoming) {
  const ids = new Set((existing || []).map((s) => String(s.SnsId)))
  const fresh = (incoming || []).filter((s) => s && !ids.has(String(s.SnsId)))
  return (existing || []).concat(fresh)
}

// actions
const actions = {
  // 设置当前微信的朋友圈列表（首次替换 / 分页追加）
  SetCircles({ state, commit }, newCircles) {
    if (!newCircles) return
    const current = state.circles
    if (
      state.pullMode === 'replace' ||
      !current.WxId ||
      !sameId(current.WxId, newCircles.WxId)
    ) {
      commit('SET_CIRCLES', newCircles)
      return
    }
    // 分页：NextSeq 变化才追加，并按 SnsId 去重，避免重拉首屏导致重复
    if (!sameId(current.NextSeq, newCircles.NextSeq)) {
      commit('UPDATE_CIRCLES', newCircles)
    }
  }
}

// mutations
const mutations = {
  SET_PULL_MODE(state, mode) {
    state.pullMode = mode === 'append' ? 'append' : 'replace'
  },
  // 设置朋友圈
  SET_CIRCLES(state, circlesData) {
    state.circles = {
      SnsList: (circlesData && circlesData.SnsList) || [],
      WxId: circlesData ? circlesData.WxId : '',
      NextSeq: circlesData && circlesData.NextSeq !== undefined && circlesData.NextSeq !== null
        ? circlesData.NextSeq
        : '',
      Success: circlesData ? circlesData.Success : null
    }
    state.pullMode = 'replace'
  },
  // 重置朋友圈数据
  RESET_CIRCLES(state) {
    state.circles = {
      SnsList: [],
      WxId: '',
      NextSeq: '',
      Success: null
    }
    state.pullMode = 'replace'
  },
  // 添加朋友圈数据（分页）
  UPDATE_CIRCLES(state, updateData) {
    state.circles.NextSeq = updateData.NextSeq
    if (updateData.SnsList) {
      state.circles.SnsList = dedupeAppend(state.circles.SnsList, updateData.SnsList)
    }
  },
  // 删除朋友圈成功后更新本地数据
  UPDATE_CIRCLES_BY_DELETE(state, delData) {
    const cc = state.circles
    if (!sameId(cc.WxId, delData.WxId)) return
    const delId = delData.TaskId
    const idx = cc.SnsList.findIndex((sns) => sameId(sns.SnsId, delId))
    if (idx >= 0) {
      cc.SnsList.splice(idx, 1)
    }
  },
  // 单条朋友圈详情（补图/刷新）回写
  UPDATE_CIRCLES_BY_ONE(state, oneData) {
    if (!oneData || !oneData.Success || !oneData.SnsInfo) return
    const cc = state.circles
    if (!sameId(cc.WxId, oneData.WxId)) return
    const targetId =
      oneData.SnsInfo.SnsId !== undefined && oneData.SnsInfo.SnsId !== null
        ? oneData.SnsInfo.SnsId
        : oneData.TaskId
    const idx = cc.SnsList.findIndex((sns) => sameId(sns.SnsId, targetId))
    if (idx >= 0) {
      cc.SnsList.splice(idx, 1, oneData.SnsInfo)
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

export { sameId, dedupeAppend }
