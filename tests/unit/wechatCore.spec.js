import { expect } from 'chai'
import {
  normalizeWxId,
  normalizeId,
  sameWxId,
  sameId,
  preferSafeConvLocalId,
  findMapKey,
  dedupeWechats,
  normalizeAvatarUrl,
  isWeworkGroupRemoteId,
  isGenericWeworkGroupAvatarUrl,
  getConversationAvatarList,
  resolveConversationAvatarUrl,
  weComNickSuffix,
  findWechatIndex,
  normalizeWechatRecord
} from '@/utils/wechat'

describe('wechat 核心 ID / 头像 / 后缀', () => {
  it('normalizeWxId / normalizeId 空值与字符串化', () => {
    expect(normalizeWxId(null)).to.equal('')
    expect(normalizeWxId(123)).to.equal('123')
    expect(normalizeId(undefined)).to.equal('')
    expect(sameWxId(123, '123')).to.equal(true)
    expect(sameId('a', 'a')).to.equal(true)
  })

  it('preferSafeConvLocalId 保留未丢精度的 prev', () => {
    expect(preferSafeConvLocalId('9007199254740993', '9007199254740992')).to.equal('9007199254740993')
    expect(preferSafeConvLocalId('', '123')).to.equal('123')
    expect(preferSafeConvLocalId('0', '456')).to.equal('456')
  })

  it('findMapKey 兼容 number/string key', () => {
    const map = { 123: 'x' }
    expect(findMapKey(map, '123')).to.equal('123')
  })

  it('dedupeWechats 按 WxId 合并', () => {
    const list = dedupeWechats([
      { wxid: '1', name: 'A', devnickname: '备注', isonline: 1 },
      { WxId: '1', name: 'A', isonline: 1 }
    ])
    expect(list).to.have.length(1)
    expect(list[0].devnickname).to.equal('备注')
  })

  it('normalizeAvatarUrl 协议前缀替换', () => {
    expect(normalizeAvatarUrl('X:WWH/foo')).to.equal('http://wework.qpic.cn/bizmail/foo')
    expect(normalizeAvatarUrl('X:WHS/bar')).to.equal('https://wework.qpic.cn/wwpic/bar')
    expect(normalizeAvatarUrl('')).to.equal('')
  })

  it('isWeworkGroupRemoteId 高位 38', () => {
    const groupId = (BigInt(38) << 48n) | 123n
    expect(isWeworkGroupRemoteId(String(groupId))).to.equal(true)
    expect(isWeworkGroupRemoteId('123')).to.equal(false)
  })

  it('isGenericWeworkGroupAvatarUrl 识别默认 logo', () => {
    expect(isGenericWeworkGroupAvatarUrl('https://wework.qpic.cn/wwpic/0')).to.equal(true)
    expect(isGenericWeworkGroupAvatarUrl('https://example.com/custom.jpg')).to.equal(false)
  })

  it('getConversationAvatarList 群成员头像优先', () => {
    const conv = {
      Type: 1,
      Members: [{ Avatar: 'X:WHS/a.jpg' }, { Avatar: 'X:WHS/b.jpg' }]
    }
    const grid = getConversationAvatarList(conv)
    expect(grid.length).to.be.at.least(1)
    expect(grid[0]).to.include('wework.qpic.cn')
  })

  it('resolveConversationAvatarUrl 单聊直读 Avatar', () => {
    const url = resolveConversationAvatarUrl({ Avatar: 'https://cdn/x.png' })
    expect(url).to.equal('https://cdn/x.png')
  })

  it('weComNickSuffix 个微不标、企微单聊默认「企微」', () => {
    const personalId = (BigInt(28) << 48n) | 1n
    expect(weComNickSuffix({ RemoteId: String(personalId) })).to.equal('')
    const weworkId = (BigInt(38) << 48n) | 1n
    expect(weComNickSuffix({ RemoteId: String(weworkId) })).to.equal('企微')
    expect(weComNickSuffix({ RemoteId: String(weworkId), Suffix: '官方' })).to.equal('官方')
  })

  it('findWechatIndex 按 WxId 或 IMEI', () => {
    const list = [{ WxId: '1', IMEI: 'imei-a' }]
    expect(findWechatIndex(list, { WxId: '1' })).to.equal(0)
    expect(findWechatIndex(list, { IMEI: 'imei-a' })).to.equal(0)
    expect(findWechatIndex(list, { WxId: '9' })).to.equal(-1)
  })

  it('resolveConversationAvatarUrl 群聊跳过 generic logo', () => {
    const conv = {
      Type: 1,
      Avatar: 'https://wework.qpic.cn/wwpic/0',
      Members: [{ Avatar: 'X:WHS/member.jpg' }]
    }
    const url = resolveConversationAvatarUrl(conv)
    expect(url).to.include('wework.qpic.cn')
    expect(url).to.not.include('/wwpic/0')
  })

  it('weComNickSuffix 群聊只返回 Suffix', () => {
    const groupId = (BigInt(38) << 48n) | 99n
    expect(
      weComNickSuffix({ RemoteId: String(groupId), Members: [{}], Suffix: '项目群' })
    ).to.equal('项目群')
  })

  it('getConversationAvatarList 单 AvatarList 非群聊可展示', () => {
    const list = getConversationAvatarList({
      RemoteId: '123',
      AvatarList: ['https://cdn.example.com/u.jpg']
    })
    expect(list).to.deep.equal(['https://cdn.example.com/u.jpg'])
  })

  it('resolveConversationAvatarUrl 群聊仅 generic logo 时返回空', () => {
    const url = resolveConversationAvatarUrl({
      Type: 1,
      Avatar: 'https://wework.qpic.cn/wwpic/0'
    })
    expect(url).to.equal('')
  })

  it('weComNickSuffix 非法 RemoteId 返回空', () => {
    expect(weComNickSuffix({ RemoteId: 'not-a-number' })).to.equal('')
  })

  it('normalizeWechatRecord 无 wxId 仅有 IMEI 也可归一', () => {
    const row = normalizeWechatRecord({ deviceid: 'imei-99', name: '设备' })
    expect(row.IMEI).to.equal('imei-99')
    expect(row.Name).to.equal('设备')
  })
})
