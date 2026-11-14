import { expect } from 'chai'
import {
  stripGroupHbContent,
  parseHbJsonContent,
  inferRedPacketOrTransfer,
  isHbExpired,
  resolveMsgRemoteId,
  resolveMsgKey,
  lookupLuckMoneyOpened,
  isTransferRefunded,
  isTransferClaimed,
  buildTakeLuckMoneyPayload,
  formatTransferAmount,
  canOpenHbChat
} from '@/utils/takeLuckMoney'

describe('takeLuckMoney', () => {
  const redPacketChat = {
    WxId: '1001',
    ConvId: '2002',
    MsgRemoteId: '3003',
    ContentType: 'LuckyMoney',
    Content: '{"Key":"hb_key_1","Title":"恭喜发财","InvalidTime":9999999999}',
    SenderId: '9999'
  }

  const transferChat = {
    WxId: '1001',
    ConvId: '2002',
    MsgRemoteId: '4004',
    ContentType: 'MoneyTrans',
    Content: '{"Key":"tf_key_1","Feedesc":"￥1.00","PaySubType":1,"InvalidTime":9999999999}',
    SenderId: '9999'
  }

  it('stripGroupHbContent 去掉 sender: 前缀', () => {
    expect(stripGroupHbContent('168885:{"Key":"a"}')).to.equal('{"Key":"a"}')
  })

  it('parseHbJsonContent 群聊解析 JSON', () => {
    const chat = {
      ...redPacketChat,
      Content: '168885:\n{"Key":"hb_key_1","Title":"恭喜发财"}\n'
    }
    const j = parseHbJsonContent(chat, true)
    expect(j).to.be.an('object')
    expect(j.Key).to.equal('hb_key_1')
  })

  it('parseHbJsonContent 非 JSON 返回 null', () => {
    expect(parseHbJsonContent({ Content: '微信红包' })).to.equal(null)
  })

  it('inferRedPacketOrTransfer 区分红包/转账', () => {
    expect(inferRedPacketOrTransfer(redPacketChat)).to.equal('redpacket')
    expect(inferRedPacketOrTransfer(transferChat)).to.equal('transfer')
  })

  it('isHbExpired 按 InvalidTime 判断', () => {
    expect(isHbExpired({ InvalidTime: 1 })).to.equal(true)
    expect(isHbExpired({ InvalidTime: Math.floor(Date.now() / 1000) + 100 })).to.equal(false)
  })

  it('resolveMsgRemoteId / resolveMsgKey', () => {
    expect(resolveMsgRemoteId(redPacketChat)).to.equal('3003')
    expect(resolveMsgKey({ Key: 'k1' })).to.equal('k1')
    expect(resolveMsgKey({ TransferId: 't1' })).to.equal('t1')
  })

  it('lookupLuckMoneyOpened 优先 MsgRemoteId', () => {
    const map = {
      '3003': { opened: true, Amount: 100, MsgKey: 'hb_key_1' }
    }
    const rec = lookupLuckMoneyOpened(map, redPacketChat, { Key: 'hb_key_1' })
    expect(rec).to.exist
    expect(rec.Amount).to.equal(100)
  })

  it('lookupLuckMoneyOpened 回退 msgkey_', () => {
    const map = {
      msgkey_hb_key_1: { opened: true, MsgKey: 'hb_key_1', Amount: 50 }
    }
    const rec = lookupLuckMoneyOpened(map, { MsgRemoteId: 'nope' }, { Key: 'hb_key_1' })
    expect(rec.Amount).to.equal(50)
  })

  it('isTransferClaimed / isTransferRefunded', () => {
    expect(isTransferClaimed(transferChat, { PaySubType: 3 })).to.equal(true)
    expect(isTransferRefunded(transferChat, { PaySubType: 4 })).to.equal(true)
    expect(
      isTransferRefunded(transferChat, { Key: 'tf_key_1' }, { '1001:tf_key_1': true }, '1001')
    ).to.equal(true)
  })

  it('buildTakeLuckMoneyPayload 使用 WW 字段 + ContentType + Refuse', () => {
    const { payload } = buildTakeLuckMoneyPayload(redPacketChat, { refuse: false })
    expect(payload).to.include({
      WxId: '1001',
      ConvId: '2002',
      MsgRemoteId: '3003',
      MsgKey: 'hb_key_1',
      Refuse: false,
      ContentType: 'LuckyMoney'
    })
    const refuse = buildTakeLuckMoneyPayload(transferChat, {
      refuse: true,
      taskId: 'tid_1'
    }).payload
    expect(refuse.Refuse).to.equal(true)
    expect(refuse.TaskId).to.equal('tid_1')
    expect(refuse.ContentType).to.equal('MoneyTrans')
  })

  it('ContentType 异常时仍强制 LuckyMoney/MoneyTrans（防服务端解码失败被 PC 静默）', () => {
    const bad = {
      ...redPacketChat,
      ContentType: 'Text',
      _hbType: 'redpacket',
      _jContent: { Key: 'hb_key_1', Title: 'x' }
    }
    expect(buildTakeLuckMoneyPayload(bad).payload.ContentType).to.equal('LuckyMoney')
    expect(
      buildTakeLuckMoneyPayload(
        { ...transferChat, ContentType: 'Picture', _hbType: 'transfer' },
        { hbType: 'transfer' }
      ).payload.ContentType
    ).to.equal('MoneyTrans')
  })

  it('formatTransferAmount', () => {
    expect(formatTransferAmount('￥1.5')).to.equal('1.50')
    expect(formatTransferAmount(100)).to.equal('1.00')
  })

  it('canOpenHbChat 拦截自己发的红包 / 非 JSON', () => {
    expect(canOpenHbChat({ ...redPacketChat, SenderId: '1001' }, { wxId: '1001' })).to.deep.include({
      ok: false
    })
    expect(canOpenHbChat({ Content: '摘要', ContentType: 'LuckyMoney' }, { wxId: '1001' })).to.deep.include({
      ok: false
    })
    const ok = canOpenHbChat(redPacketChat, { wxId: '1001' })
    expect(ok.ok).to.equal(true)
    expect(ok.hbType).to.equal('redpacket')
  })
})
