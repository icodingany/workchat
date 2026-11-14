/* global BigInt */
import { expect } from 'chai'
import { weComNickSuffix } from '@/utils/wechat'

/** 构造带类型高位的 RemoteId（协议 RemoteId>>48） */
function remoteIdWithType(type, low = 1) {
  return String((BigInt(type) << 48n) | BigInt(low))
}

describe('weComNickSuffix', () => {
  it('个微单聊（高位 28）不显示后缀', () => {
    const message = { RemoteId: remoteIdWithType(28), Name: '演示联系人' }
    expect(weComNickSuffix(message)).to.equal('')
  })

  it('企微单聊无 Suffix 显示「企微」', () => {
    const message = { RemoteId: remoteIdWithType(33), Name: '演示联系人' }
    expect(weComNickSuffix(message)).to.equal('企微')
  })

  it('企微单聊有 Suffix 显示公司名', () => {
    const message = { RemoteId: remoteIdWithType(33), Suffix: '某某科技', Name: '演示联系人' }
    expect(weComNickSuffix(message)).to.equal('某某科技')
  })

  it('Suffix 可从 contactsMap 补齐', () => {
    const rid = remoteIdWithType(33)
    const message = { RemoteId: rid, Name: '演示联系人' }
    const contactsMap = { [rid]: { Suffix: '补齐公司' } }
    expect(weComNickSuffix(message, contactsMap)).to.equal('补齐公司')
  })

  it('群聊（Members）无 Suffix 不强制企微', () => {
    const message = {
      RemoteId: remoteIdWithType(33),
      Members: [{ RemoteId: '1' }],
      Name: '群'
    }
    expect(weComNickSuffix(message)).to.equal('')
  })

  it('群聊有 Suffix 仍显示', () => {
    const message = {
      RemoteId: remoteIdWithType(33),
      AvatarList: ['a'],
      Suffix: '外部群',
      Name: '群'
    }
    expect(weComNickSuffix(message)).to.equal('外部群')
  })

  it('RemoteId 缺失返回空', () => {
    expect(weComNickSuffix({ Name: 'x' })).to.equal('')
    expect(weComNickSuffix(null)).to.equal('')
  })

  it('个微即使有 Suffix 也不显示（避免误标）', () => {
    const message = {
      RemoteId: remoteIdWithType(28),
      Suffix: '不该显示',
      Name: '演示联系人'
    }
    expect(weComNickSuffix(message)).to.equal('')
  })
})
