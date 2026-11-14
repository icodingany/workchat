import { expect } from 'chai'
import {
  chatUniqKey,
  mergeDedupeAndSort,
  insertChatSorted,
  splitRevokeNoticeCollision,
  isRevokeSystemNotice,
  mergeChatFields,
  capMessagesTail,
  fingerprintKey,
  CURRENT_CHATS_SOFT_CAP
} from '@/utils/chatMerge'

describe('chatMerge', () => {
  it('优先用 MsgRemoteId 去重', () => {
    expect(chatUniqKey({ MsgRemoteId: '10', MsgId: '1' })).to.equal('r:10')
  })

  it('无 Remote 用 MsgId；无则 TaskId', () => {
    expect(chatUniqKey({ MsgId: '5' })).to.equal('m:5')
    expect(chatUniqKey({ TaskId: '9' })).to.equal('t:9')
  })

  it('空键不互删', () => {
    const a = [{ Content: 'a' }, { Content: 'b' }]
    expect(mergeDedupeAndSort(a, [])).to.have.length(2)
  })

  it('capMessagesTail 只保留尾部', () => {
    const list = Array.from({ length: 120 }, (_, i) => ({ MsgId: String(i) }))
    const capped = capMessagesTail(list, CURRENT_CHATS_SOFT_CAP)
    expect(capped).to.have.length(CURRENT_CHATS_SOFT_CAP)
    expect(capped[0].MsgId).to.equal(String(120 - CURRENT_CHATS_SOFT_CAP))
    expect(capped[capped.length - 1].MsgId).to.equal('119')
    expect(capMessagesTail(list.slice(0, 10), CURRENT_CHATS_SOFT_CAP)).to.have.length(10)
  })

  it('HTTP 行与同 MsgRemoteId 本地合并为一条', () => {
    const old = [{ MsgRemoteId: '88', Content: 'local', TaskId: '1' }]
    const inc = [{ MsgRemoteId: '88', MsgId: '99', Content: 'server' }]
    const m = mergeDedupeAndSort(old, inc)
    expect(m).to.have.length(1)
    expect(String(m[0].MsgId)).to.equal('99')
  })

  it('空 incoming 不清空 old', () => {
    const old = [{ MsgId: '1', Content: 'x', CreateTime: 1 }]
    expect(mergeDedupeAndSort(old, [])).to.have.length(1)
  })

  it('同 TaskId 的 LocalSend 与回执合成一条', () => {
    const old = [{ TaskId: 't1', Content: 'hi', LocalSend: true, CreateTime: 100 }]
    const inc = [{ TaskId: 't1', MsgId: 'm1', MsgRemoteId: 'r1', Content: 'hi', CreateTime: 101 }]
    const m = mergeDedupeAndSort(old, inc)
    expect(m).to.have.length(1)
    expect(String(m[0].MsgId)).to.equal('m1')
    expect(m[0].LocalSend).to.not.equal(true)
  })

  it('无 id 时同会话同正文短时间窗指纹合并', () => {
    const a = {
      WxId: 'w1', ConvId: 'c1', ContentType: 'Text', Content: 'same', CreateTime: 1000
    }
    const b = {
      WxId: 'w1', ConvId: 'c1', ContentType: 'Text', Content: 'same', CreateTime: 1500, MsgId: 'm9'
    }
    const m = mergeDedupeAndSort([a], [b])
    expect(m).to.have.length(1)
    expect(String(m[0].MsgId)).to.equal('m9')
  })

  it('insertChatSorted 命中 TaskId 时合并而非双条', () => {
    const list = [{ TaskId: 't1', Content: 'a', LocalSend: true, CreateTime: 1 }]
    const next = insertChatSorted(list, {
      TaskId: 't1', MsgRemoteId: '99', Content: 'a', CreateTime: 2
    })
    expect(next).to.have.length(1)
    expect(String(next[0].MsgRemoteId)).to.equal('99')
  })

  it('撤回通知与原文同键时拆成两条', () => {
    const original = { MsgRemoteId: '88', Content: 'hello', ContentType: 'Text', CreateTime: 1 }
    const notice = {
      MsgRemoteId: '88', Content: '撤回了一条消息', ContentType: 'System',
      CreateTime: 2, IsRevokeNotice: true
    }
    const split = splitRevokeNoticeCollision(original, notice)
    expect(split).to.not.equal(null)
    expect(split.original.isPreviousRevoked).to.equal(true)
    expect(isRevokeSystemNotice(split.notice)).to.equal(true)
    const m = mergeDedupeAndSort([original], [notice])
    expect(m).to.have.length(2)
  })

  it('合并时保留发送失败 Flag，不被无 Flag 的 HTTP 行冲掉', () => {
    const prev = { MsgRemoteId: '0', MsgId: '77', Content: 'fail', Flag: 0x10000, Status: 5 }
    const http = { MsgRemoteId: '0', MsgId: '77', Content: 'fail' }
    const m = mergeChatFields(prev, http)
    expect((Number(m.Flag) & 0x10000) === 0x10000).to.equal(true)
    expect(Number(m.Status)).to.equal(5)
  })

  it('合并时 WS 空 Content 不得冲掉 HTTP 小写 content', () => {
    const prev = { MsgRemoteId: '88', contentType: '1', content: '订单号 ORD123' }
    const inc = { MsgRemoteId: '88', ContentType: 'Text', Content: '', MsgId: '99' }
    const m = mergeDedupeAndSort([prev], [inc])
    expect(m).to.have.length(1)
    expect(m[0].Content).to.equal('订单号 ORD123')
    expect(String(m[0].MsgId)).to.equal('99')
  })

  it('多条英文 has added System 全部隐藏', () => {
    const msgs = [
      { MsgRemoteId: '1', ContentType: 'System', Content: '<i></i> has added A', CreateTime: 10 },
      { MsgRemoteId: '2', ContentType: 'System', Content: '<i></i> has added B', CreateTime: 20 },
      { MsgRemoteId: '3', ContentType: 'Text', Content: 'hello', CreateTime: 30 },
      { MsgRemoteId: '4', ContentType: 'System', Content: '<i></i> has added C', CreateTime: 40 }
    ]
    const m = mergeDedupeAndSort([], msgs)
    expect(m).to.have.length(1)
    expect(m[0].Content).to.equal('hello')
  })

  it('合并时清掉 PC 误标 Status=5，保留协议层失败', () => {
    const prev = {
      TaskId: 't1',
      MsgId: 't1',
      Content: 'pic',
      LocalSend: true,
      Status: 5,
      SendFailReason: '发送超时'
    }
    const notice = {
      TaskId: 't1',
      MsgId: 'm1',
      MsgRemoteId: 'r1',
      Content: 'pic',
      CreateTime: 101
    }
    const m = mergeChatFields(prev, notice)
    expect(String(m.MsgRemoteId)).to.equal('r1')
    expect(m.Status).to.be.undefined
    expect(m.SendFailReason).to.be.undefined
  })

  it('fingerprintKey 相同窗口合并', () => {
    const t = 10000
    const a = {
      WxId: '1',
      ConvId: '2',
      ContentType: 'Text',
      Content: 'same',
      CreateTime: t
    }
    const b = { ...a, MsgId: '99' }
    expect(fingerprintKey(a)).to.equal(fingerprintKey(b))
    const m = mergeDedupeAndSort([a], [b])
    expect(m).to.have.length(1)
  })

  it('insertChatSorted 按时间插入', () => {
    const list = [{ CreateTime: 10, MsgRemoteId: '1', Content: 'a' }]
    const inserted = insertChatSorted(list, { CreateTime: 20, MsgRemoteId: '2', Content: 'b' })
    expect(inserted).to.have.length(2)
    expect(inserted[1].MsgRemoteId).to.equal('2')
  })
})
