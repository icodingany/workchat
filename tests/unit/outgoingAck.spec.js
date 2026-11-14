import { expect } from 'chai'
import {
  handleTalkToFriendTaskResult,
  handleTalkToFriendNotice,
  ingestTalkNoticeToStore
} from '@/utils/outgoingAck'

function makeStore({ messages = [], isGroup = false } = {}) {
  const dispatches = []
  const friend = isGroup ? { Members: [{ RemoteId: 'm1' }] } : {}
  return {
    dispatches,
    getters: {
      'conversation/currentFriend': friend
    },
    dispatch(type, payload) {
      dispatches.push({ type, payload })
      return Promise.resolve()
    }
  }
}

describe('handleTalkToFriendTaskResult', () => {
  it('success + MsgRemoteId → ApplyTalkResultToLocal', () => {
    const store = makeStore()
    const r = handleTalkToFriendTaskResult(store, {
      Success: true,
      TaskId: '800000000000080008',
      MsgRemoteId: 1352412
    })
    expect(r).to.equal('success')
    expect(store.dispatches.map((d) => d.type)).to.deep.equal([
      'conversation/ApplyTalkResultToLocal'
    ])
  })

  it('success 无回执 id、私聊 → 触发 PendingSync 兜底', () => {
    const store = makeStore()
    handleTalkToFriendTaskResult(store, { success: true, TaskId: '1' })
    expect(store.dispatches.map((d) => d.type)).to.deep.equal([
      'conversation/ApplyTalkResultToLocal',
      'conversation/ScheduleOutgoingAckFallback'
    ])
  })

  it('success 无回执 id、群聊 → 不触发 PendingSync', () => {
    const store = makeStore({ isGroup: true })
    handleTalkToFriendTaskResult(store, { Success: true, TaskId: '1' })
    expect(store.dispatches.map((d) => d.type)).to.deep.equal([
      'conversation/ApplyTalkResultToLocal'
    ])
  })

  it('success=false + err（生产 timeout）→ MarkLocalSendFailed', () => {
    const store = makeStore()
    const r = handleTalkToFriendTaskResult(store, {
      success: false,
      TaskId: '800000000000070007',
      ErrMsg: 'timeout(8000000000000130013, 8000000000000130013)'
    })
    expect(r).to.equal('failed')
    expect(store.dispatches[0].type).to.equal('conversation/MarkLocalSendFailed')
  })

  it('缺省 Success 且无 err → ignored（交给 8s/20s 兜底）', () => {
    const store = makeStore()
    expect(handleTalkToFriendTaskResult(store, { TaskId: '9' })).to.equal('ignored')
    expect(store.dispatches).to.have.length(0)
  })
})

describe('handleTalkToFriendNotice', () => {
  it('走统一入库路径，不删本地预览', () => {
    const store = makeStore()
    handleTalkToFriendNotice(store, { TaskId: '1', WxId: 'w', ConvId: 'c', Content: 'hi' })
    expect(store.dispatches.map((d) => d.type)).to.deep.equal([
      'conversation/UpdateConversations',
      'conversation/AddChats'
    ])
  })
})

describe('ingestTalkNoticeToStore', () => {
  it('FriendTalkNotice 与出站 Notice 共用 dispatch', () => {
    const store = makeStore()
    ingestTalkNoticeToStore(store, { WxId: 'w', ConvId: 'c' })
    expect(store.dispatches.map((d) => d.type)).to.deep.equal([
      'conversation/UpdateConversations',
      'conversation/AddChats'
    ])
  })
})
