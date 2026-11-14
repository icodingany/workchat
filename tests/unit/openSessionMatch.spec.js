import { expect } from 'chai'
import {
  matchesCurrentChatSession,
  currentChatsBelongToSession
} from '@/utils/openSessionMatch'

describe('openSessionMatch', () => {
  const getters = {
    currentWeChatId: '8000000000020002',
    currentFriendId: '8000000000180018',
    currentFriend: {
      RemoteId: '8000000000180018',
      Id: '8000000000000120012'
    }
  }

  it('命中 RemoteId / FriendId', () => {
    expect(matchesCurrentChatSession(getters, '8000000000020002', '8000000000180018')).to.equal(true)
  })

  it('命中会话 LocalId 别名', () => {
    expect(matchesCurrentChatSession(getters, '8000000000020002', '8000000000000120012')).to.equal(true)
  })

  it('拒绝跨会话 / 跨微信号', () => {
    expect(matchesCurrentChatSession(getters, '8000000000020002', '999')).to.equal(false)
    expect(matchesCurrentChatSession(getters, '1', '8000000000180018')).to.equal(false)
  })

  it('currentChatsBelongToSession：空可写；同会话可写；异会话否', () => {
    expect(currentChatsBelongToSession({ Messages: [], WxId: '', ConvId: '' }, '1', '2')).to.equal(true)
    expect(
      currentChatsBelongToSession(
        { Messages: [{ MsgId: '1' }], WxId: '1', ConvId: '2' },
        '1',
        '2'
      )
    ).to.equal(true)
    expect(
      currentChatsBelongToSession(
        { Messages: [{ MsgId: '1' }], WxId: '1', ConvId: '9' },
        '1',
        '2'
      )
    ).to.equal(false)
  })

  it('空消息列表但 WxId/ConvId 已绑定须匹配', () => {
    expect(
      currentChatsBelongToSession({ Messages: [], WxId: '1', ConvId: '2' }, '1', '2')
    ).to.equal(true)
    expect(
      currentChatsBelongToSession({ Messages: [], WxId: '1', ConvId: '9' }, '1', '2')
    ).to.equal(false)
  })

  it('matchesCurrentChatSession 缺 wx/conv 返回 false', () => {
    expect(matchesCurrentChatSession(getters, '', '8000000000180018')).to.equal(false)
    expect(matchesCurrentChatSession(getters, '8000000000020002', '')).to.equal(false)
  })
})
