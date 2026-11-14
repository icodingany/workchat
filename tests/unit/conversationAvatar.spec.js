import { expect } from 'chai'
import {
  getConversationAvatarList,
  resolveConversationAvatarUrl,
  isGenericWeworkGroupAvatarUrl,
  normalizeAvatarUrl
} from '@/utils/wechat'

const GENERIC =
  'https://wework.qpic.cn/wwpic3az/wwwx_5dc9277b73f1dbe1a9204f8f28ff3da2/0'
const MEMBER_A = 'https://wework.qpic.cn/wwpic/a.jpg'
const MEMBER_B = 'https://wework.qpic.cn/wwpic/b.jpg'

describe('conversationAvatar', () => {
  it('识别企微默认群 logo', () => {
    expect(isGenericWeworkGroupAvatarUrl(GENERIC)).to.equal(true)
    expect(isGenericWeworkGroupAvatarUrl(MEMBER_A)).to.equal(false)
  })

  it('群聊优先 Members 拼图，忽略默认 Avatar', () => {
    const conv = {
      Type: 1,
      Avatar: GENERIC,
      Members: [{ Avatar: MEMBER_A }, { Avatar: MEMBER_B }]
    }
    expect(getConversationAvatarList(conv)).to.deep.equal([MEMBER_A, MEMBER_B])
    expect(resolveConversationAvatarUrl(conv)).to.equal(MEMBER_A)
  })

  it('AvatarList 多图直接用于九宫格', () => {
    const conv = {
      Type: 1,
      Avatar: GENERIC,
      AvatarList: [MEMBER_A, MEMBER_B, MEMBER_A]
    }
    expect(getConversationAvatarList(conv)).to.deep.equal([MEMBER_A, MEMBER_B])
  })

  it('单聊仍用 Avatar 字段', () => {
    const conv = { Type: 0, Avatar: MEMBER_A }
    expect(resolveConversationAvatarUrl(conv)).to.equal(MEMBER_A)
  })

  it('群聊 RemoteId 高位 38 识别为群', () => {
    const rid = String((BigInt(38) << 48n) | BigInt(1))
    const conv = { Type: 0, RemoteId: rid, Avatar: GENERIC }
    expect(getConversationAvatarList(conv)).to.deep.equal([])
  })
})
