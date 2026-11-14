import { expect } from 'chai'
import {
  isDigestAheadOfMessages,
  shouldTriggerPhoneHistorySync,
  buildDigestPreviewChat,
  buildStrangerTipChat,
  resolveStrangerTipText,
  messagesHaveStrangerTip,
  messagesHaveFriendAddEvidence,
  OPEN_SESSION_POLL_INTERVAL_MS,
  OPEN_SESSION_POLL_MAX_MS
} from '@/utils/openSessionHistory'
import { mergeDedupeAndSort } from '@/utils/chatMerge'

describe('openSessionHistory', () => {
  it('无消息但有真实 Digest → ahead', () => {
    expect(isDigestAheadOfMessages({ Digest: '你好', CreateTime: 100 }, [])).to.equal(true)
  })

  it('陌生人 Digest 不算 ahead', () => {
    expect(
      isDigestAheadOfMessages({ Digest: '张三还不是你的联系人', CreateTime: 100 }, [])
    ).to.equal(false)
  })

  it('消息 CreateTime 落后会话 CreateTime → ahead', () => {
    const conv = { Digest: '新', CreateTime: 200 }
    const msgs = [{ Content: '旧', CreateTime: 100 }]
    expect(isDigestAheadOfMessages(conv, msgs)).to.equal(true)
  })

  it('毫秒/秒混用时不误判 ahead', () => {
    const conv = { Digest: '新', UpdateTime: 1784948893000 }
    const msgs = [{ Content: '旧', CreateTime: 1784948893 }]
    expect(isDigestAheadOfMessages(conv, msgs)).to.equal(false)
  })

  it('shouldTrigger：空消息无 Digest → 不拉（避免假空会话打爆手机同步）', () => {
    expect(shouldTriggerPhoneHistorySync({ Digest: '', CreateTime: 1 }, [])).to.equal(false)
    expect(shouldTriggerPhoneHistorySync({}, [])).to.equal(false)
    expect(shouldTriggerPhoneHistorySync(null, [])).to.equal(false)
  })

  it('shouldTrigger：空消息有真实 Digest → 拉；已对齐则不拉', () => {
    expect(shouldTriggerPhoneHistorySync({ Digest: 'x', CreateTime: 1 }, [])).to.equal(true)
    expect(
      shouldTriggerPhoneHistorySync({ Digest: 'x', CreateTime: 1 }, [{ CreateTime: 2, Content: 'x' }])
    ).to.equal(false)
  })

  it('shouldTrigger：非好友 Digest 即使已有消息也强制拉', () => {
    expect(
      shouldTriggerPhoneHistorySync(
        { Digest: '示例客户甲还不是你的联系人', CreateTime: 1 },
        [{ CreateTime: 2, Content: 'hi' }]
      )
    ).to.equal(true)
  })

  it('Digest 预览气泡：真实摘要有、陌生人无', () => {
    const p = buildDigestPreviewChat({ Digest: '测试', UpdateTime: 100 }, '1', '2')
    expect(p).to.include({ Content: '测试', ContentType: 'Text' })
    expect(p._digestPreview).to.equal(true)
    expect(buildDigestPreviewChat({ Digest: '张三还不是你的联系人' }, '1', '2')).to.equal(null)
  })

  it('非好友 tip：Digest 优先；无 Digest 用昵称拼句', () => {
    expect(resolveStrangerTipText({ Digest: '示例客户甲还不是你的联系人' })).to.equal(
      '示例客户甲还不是你的联系人'
    )
    expect(resolveStrangerTipText({ Name: '示例客户甲', RemoteId: '99', Type: 0 }, {})).to.equal(
      '示例客户甲还不是你的联系人'
    )
    expect(resolveStrangerTipText({ Digest: '你好', RemoteId: '1' }, { '1': {} })).to.equal('')
  })

  it('刚加好友：Digest「你已添加了」不再提示非联系人', () => {
    expect(
      resolveStrangerTipText(
        { Digest: '你已添加了示例客户乙, 现在可以开始聊天了。', Name: '示例客户乙', RemoteId: '9' },
        {}
      )
    ).to.equal('')
  })

  it('刚加好友：消息里已有「你已添加了」→ 不注入 tip（即使 contactsMap 未同步）', () => {
    const tip = buildStrangerTipChat(
      { Name: '示例客户乙', RemoteId: '9', Type: 0, Digest: '请发付款截图' },
      'wx',
      'cid',
      {},
      [
        { ContentType: 'System', Content: '你已添加了示例客户乙, 现在可以开始聊天了。', CreateTime: 100 },
        { ContentType: 'Text', Content: '请发付款截图', CreateTime: 200 }
      ]
    )
    expect(tip).to.equal(null)
  })

  it('buildStrangerTipChat：System + _strangerTip，排在最早消息前', () => {
    const tip = buildStrangerTipChat(
      { Digest: '示例客户甲还不是你的联系人', UpdateTime: 500 },
      'wx',
      'cid',
      {},
      [{ Content: 'hi', CreateTime: 200 }]
    )
    expect(tip).to.include({ ContentType: 'System', Content: '示例客户甲还不是你的联系人' })
    expect(tip._strangerTip).to.equal(true)
    expect(tip.MsgId).to.equal('stranger-tip:cid')
    expect(tip.CreateTime).to.equal(199)
  })

  it('messagesHaveStrangerTip 识别本地与真实 System', () => {
    expect(messagesHaveStrangerTip([], 'x')).to.equal(false)
    expect(messagesHaveStrangerTip([{ _strangerTip: true }], 'x')).to.equal(true)
    expect(
      messagesHaveStrangerTip(
        [{ ContentType: 'System', Content: '甲还不是你的联系人' }],
        '甲还不是你的联系人'
      )
    ).to.equal(true)
  })

  it('merge：有真实陌生人 System 时去掉本地 tip；普通消息保留 tip', () => {
    const local = {
      MsgId: 'stranger-tip:1',
      ContentType: 'System',
      Content: '示例客户甲还不是你的联系人',
      CreateTime: 1,
      _strangerTip: true
    }
    const text = { MsgId: 'm1', MsgRemoteId: '10', ContentType: 'Text', Content: 'hi', CreateTime: 2 }
    const kept = mergeDedupeAndSort([local], [text])
    expect(kept.some((c) => c && c._strangerTip)).to.equal(true)

    const realSys = {
      MsgId: 's1',
      MsgRemoteId: '20',
      ContentType: 'System',
      Content: '示例客户甲还不是你的联系人',
      CreateTime: 3
    }
    const deduped = mergeDedupeAndSort([local, text], [realSys])
    expect(deduped.some((c) => c && c._strangerTip)).to.equal(false)
    expect(deduped.some((c) => c && c.MsgRemoteId === '20')).to.equal(true)
  })

  it('merge：消息含「你已添加了」时去掉本地非联系人 tip 且隐藏加好友问候', () => {
    const local = {
      MsgId: 'stranger-tip:1',
      ContentType: 'System',
      Content: '示例客户乙还不是你的联系人',
      CreateTime: 1,
      _strangerTip: true
    }
    const added = {
      MsgId: 's1',
      MsgRemoteId: '30',
      ContentType: 'System',
      Content: '你已添加了示例客户乙, 现在可以开始聊天了。',
      CreateTime: 2
    }
    const merged = mergeDedupeAndSort([local], [added])
    expect(merged.some((c) => c && c._strangerTip)).to.equal(false)
    expect(merged.some((c) => c && c.MsgRemoteId === '30')).to.equal(false)
  })

  it('轮询常量合理', () => {
    expect(OPEN_SESSION_POLL_INTERVAL_MS).to.be.at.least(500)
    expect(OPEN_SESSION_POLL_MAX_MS).to.be.at.least(10000)
  })

  it('messagesHaveFriendAddEvidence 识别加好友 System 正文', () => {
    expect(
      messagesHaveFriendAddEvidence([{ Content: '你已添加了张三, 现在可以开始聊天了。' }])
    ).to.equal(true)
    expect(messagesHaveFriendAddEvidence([{ Content: '普通消息' }])).to.equal(false)
  })

  it('resolveStrangerTipText 非好友拼昵称；已是好友返回空', () => {
    const conv = { RemoteId: '9', Name: '示例客户甲', Digest: '' }
    expect(resolveStrangerTipText(conv, {})).to.equal('示例客户甲还不是你的联系人')
    expect(resolveStrangerTipText(conv, { '9': { Name: '示例客户甲' } })).to.equal('')
    expect(
      resolveStrangerTipText({ Digest: '你已添加了示例客户甲' }, {})
    ).to.equal('')
  })

  it('buildStrangerTipChat 生成本地 tip', () => {
    const tip = buildStrangerTipChat(
      { RemoteId: '9', Name: '示例客户甲', Digest: '示例客户甲还不是你的联系人' },
      'wx1',
      '9',
      {},
      []
    )
    expect(tip).to.not.equal(null)
    expect(tip._strangerTip).to.equal(true)
    expect(String(tip.Content)).to.include('还不是你的联系人')
  })

  it('已有加好友证据时不注入 stranger tip', () => {
    const tip = buildStrangerTipChat(
      { RemoteId: '9', Name: '示例客户甲', Digest: '示例客户甲还不是你的联系人' },
      'wx1',
      '9',
      {},
      [{ Content: '你已添加了示例客户甲' }]
    )
    expect(tip).to.equal(null)
  })
})
