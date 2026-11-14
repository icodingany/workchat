import { expect } from 'chai'
import { mergeConversationUnreadCnt } from '@/utils/conversationDigest'

describe('mergeConversationUnreadCnt', () => {
  it('手机帧省略 UnreadCnt 时保留本地未读', () => {
    expect(mergeConversationUnreadCnt({ UpdateTime: 2000 }, { UnreadCnt: 3, UpdateTime: 1000 })).to.equal(3)
  })

  it('显式 UnreadCnt=0 且 UpdateTime 更新时清零', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 0, UpdateTime: 3000 },
        { UnreadCnt: 2, UpdateTime: 2000 }
      )
    ).to.equal(0)
  })

  it('本地已读后同 UpdateTime 的陈旧快照不得复活未读', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 3, UpdateTime: 2000 },
        { UnreadCnt: 0, UpdateTime: 2000, ReadAt: 2001 }
      )
    ).to.equal(0)
  })

  it('无 ReadAt 时同时间戳可接受新未读', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 1, UpdateTime: 2000 },
        { UnreadCnt: 0, UpdateTime: 2000 }
      )
    ).to.equal(1)
  })

  it('真正有更新时间的新消息未读应生效', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 1, UpdateTime: 3000 },
        { UnreadCnt: 0, UpdateTime: 2000, ReadAt: 2500 }
      )
    ).to.equal(1)
  })

  it('同时间戳不得放大本地未读计数', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 5, UpdateTime: 2000 },
        { UnreadCnt: 2, UpdateTime: 2000 }
      )
    ).to.equal(2)
  })

  it('FriendTalk 累加后手机帧 UnreadCnt=0 但 UpdateTime 更新时保留本地未读', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 0, UpdateTime: 3001 },
        { UnreadCnt: 1, UpdateTime: 3000, UnreadBumpAt: 3000 }
      )
    ).to.equal(1)
  })

  it('PC 已回复后手机滞后 UnreadCnt 不得复活角标（秒级 UpdateTime vs ms ReadAt）', () => {
    const readAtMs = 1724640123456
    const replySec = 1724640123
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 3, UpdateTime: replySec + 1 },
        { UnreadCnt: 0, UpdateTime: replySec, ReadAt: readAtMs }
      )
    ).to.equal(0)
  })

  it('已读后真正新消息（UpdateTime 晚于 ReadAt 宽限期）仍应显示未读', () => {
    const readAtMs = 1724640123456
    const newMsgSec = 1724640500
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 1, UpdateTime: newMsgSec },
        { UnreadCnt: 0, UpdateTime: 1724640123, ReadAt: readAtMs }
      )
    ).to.equal(1)
  })
})
