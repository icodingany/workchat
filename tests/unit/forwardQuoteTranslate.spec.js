import { expect } from 'chai'
import {
  resolveMsgRemoteId,
  canForwardChat,
  buildForwardMultiPayload,
  shouldShowMergeForward,
  canQuoteChat,
  isConvTop,
  buildForwardRecentConvs,
  getForwardTargetId,
  resolveForwardConvLocalId,
  toggleForwardSelectionByTab
} from '@/utils/forwardHelpers'

describe('forwardHelpers', () => {
  it('resolveMsgRemoteId 优先 MsgRemoteId', () => {
    expect(resolveMsgRemoteId({ MsgRemoteId: '100', msgSvrId: '9' })).to.equal('100')
  })

  it('无 remoteId 不可转发', () => {
    expect(canForwardChat({ ContentType: 'Text' })).to.equal(false)
    expect(canForwardChat({ ContentType: 'Text', MsgRemoteId: '1' })).to.equal(true)
  })

  it('逐条 Multi 载荷 Merge 为 false', () => {
    const p = buildForwardMultiPayload({
      WxId: '1',
      MsgIds: ['10', '11'],
      ConvIds: ['20'],
      Merge: false,
      TaskId: 99
    })
    expect(p.Merge).to.equal(false)
    expect(p.MsgIds).to.deep.equal(['10', '11'])
  })

  it('合并入口需能力位', () => {
    expect(shouldShowMergeForward(true, 2)).to.equal(true)
    expect(shouldShowMergeForward(false, 2)).to.equal(false)
    expect(shouldShowMergeForward(true, 1)).to.equal(false)
  })

  it('可引用类型需有 MsgRemoteId', () => {
    expect(canQuoteChat({ ContentType: 'Text', MsgRemoteId: '1' })).to.equal(true)
    expect(canQuoteChat({ ContentType: 'Text' })).to.equal(false)
    expect(canQuoteChat({ ContentType: 'System', MsgRemoteId: '1' })).to.equal(false)
  })

  it('最近聊天排除置顶会话', () => {
    const convs = [
      { RemoteId: '1', isTop: true, Name: '置顶' },
      { RemoteId: '2', IsTop: false, Name: '普通' },
      { RemoteId: '3', Name: '无置顶字段' }
    ]
    expect(isConvTop(convs[0])).to.equal(true)
    const recent = buildForwardRecentConvs(convs)
    expect(recent.map((c) => c.RemoteId)).to.deep.equal(['2', '3'])
  })

  it('最近聊天可排除当前会话', () => {
    const convs = [
      { RemoteId: '100', Name: '当前' },
      { RemoteId: '200', Name: '其他' }
    ]
    const recent = buildForwardRecentConvs(convs, { excludeRemoteId: '100' })
    expect(recent.map((c) => c.RemoteId)).to.deep.equal(['200'])
  })

  it('getForwardTargetId 使用 RemoteId', () => {
    expect(getForwardTargetId({ RemoteId: 12345 })).to.equal('12345')
    expect(getForwardTargetId({ Name: '无ID' })).to.equal('')
  })

  it('resolveForwardConvLocalId 回查 LocalId', () => {
    const convs = [{ RemoteId: '99', Id: 'local-1' }]
    expect(resolveForwardConvLocalId(convs, '99')).to.equal('local-1')
    expect(resolveForwardConvLocalId(convs, 'missing')).to.equal(0)
  })

  it('toggleForwardSelectionByTab 切换选中', () => {
    const row = { RemoteId: '1', Name: 'A' }
    let sel = toggleForwardSelectionByTab({ chat: [], friends: [], chatrooms: [] }, 'chat', row)
    expect(sel.chat).to.have.length(1)
    sel = toggleForwardSelectionByTab(sel, 'chat', row)
    expect(sel.chat).to.have.length(0)
  })
})
