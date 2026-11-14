import { expect } from 'chai'
import {
  normalizeWechatRecord,
  mergeWechatRecord,
  wechatDisplayName,
  isWechatOnline,
  ISONLINE_ONLINE,
  ISONLINE_OFFLINE
} from '@/utils/wechat'

describe('normalizeWechatRecord devnickname', () => {
  it('maps devnickname from GetWeChatsResp snake_case field', () => {
    const row = normalizeWechatRecord({
      wxid: '1688',
      name: '张三',
      devnickname: '销售一部',
      isonline: 1
    })
    expect(row.devnickname).to.equal('销售一部')
    expect(wechatDisplayName(row, true)).to.equal('销售一部')
    expect(wechatDisplayName(row, false)).to.equal('张三')
  })

  it('wechatDisplayName falls back to Name when remark empty', () => {
    const row = normalizeWechatRecord({
      wxid: '1688',
      name: '张三',
      isonline: 1
    })
    expect(wechatDisplayName(row, true)).to.equal('张三')
    expect(wechatDisplayName(row, false)).to.equal('张三')
  })

  it('mergeWechatRecord keeps prev devnickname when incoming is empty', () => {
    const prev = normalizeWechatRecord({
      wxid: '1688',
      name: '张三',
      devnickname: '备注A',
      isonline: 1
    })
    const online = normalizeWechatRecord({
      wxid: '1688',
      name: '张三',
      isonline: 1
    })
    const merged = mergeWechatRecord(prev, online)
    expect(merged.devnickname).to.equal('备注A')
  })
})

describe('isonline 语义（1=在线 0=离线）', () => {
  it('normalizeWechatRecord 保留 isonline=1 为在线', () => {
    const row = normalizeWechatRecord({ wxid: '1', name: 'A', isonline: 1 })
    expect(row.isonline).to.equal(ISONLINE_ONLINE)
    expect(isWechatOnline(row)).to.equal(true)
  })

  it('normalizeWechatRecord 保留 isonline=0 为离线', () => {
    const row = normalizeWechatRecord({ wxid: '1', name: 'A', isonline: 0 })
    expect(row.isonline).to.equal(ISONLINE_OFFLINE)
    expect(isWechatOnline(row)).to.equal(false)
  })

  it('兼容布尔 IsOnline：true 映射为在线', () => {
    expect(isWechatOnline({ IsOnline: true })).to.equal(true)
    expect(normalizeWechatRecord({ wxid: '1', IsOnline: true }).isonline).to.equal(ISONLINE_ONLINE)
  })
})
