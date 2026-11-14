import { expect } from 'chai'
import {
  buildPinnedDigest,
  isFriendAddGreetingDigest,
  shouldShowConversationUnreadBadge,
  isConversationDigestPinned,
  detectAtMeInGroupTalk,
  mergeConversationTopFlag,
  mergeConversationUnreadCnt,
  clearAtMePinFields
} from '@/utils/conversationDigest'

describe('conversationDigest', () => {
  it('红包/转账/atme 钉住', () => {
    expect(buildPinnedDigest({ ContentType: 'LuckyMoney', MsgRemoteId: '1' }, '[红包]', false))
      .to.include({ PinnedKind: 'redpacket', PinnedDigest: '[红包]' })
    expect(buildPinnedDigest({ ContentType: 'MoneyTrans', MsgRemoteId: '2' }, '[转账]', false))
      .to.include({ PinnedKind: 'transfer' })
    expect(buildPinnedDigest({ ContentType: 'Text', MsgRemoteId: '3' }, 'hi', true))
      .to.include({ PinnedKind: 'atme' })
  })

  it('加好友问候摘要', () => {
    expect(isFriendAddGreetingDigest('你已添加了张三')).to.equal(true)
    expect(isFriendAddGreetingDigest('你好')).to.equal(false)
    expect(isFriendAddGreetingDigest('<img/> has added <b>梦醒了</b>')).to.equal(true)
    expect(isFriendAddGreetingDigest("You've added Alice, Start chatting!")).to.equal(true)
  })

  it('免打扰不计角标', () => {
    expect(shouldShowConversationUnreadBadge({ UnreadCnt: 3, Notified: false })).to.equal(false)
    expect(shouldShowConversationUnreadBadge({ UnreadCnt: 3, Notified: true })).to.equal(true)
  })

  it('群 @我 检测', () => {
    expect(
      detectAtMeInGroupTalk(
        { Members: [{}], ContentType: 'Text', Content: 'xxx:@张三 你好' },
        '张三'
      )
    ).to.equal(true)
    expect(detectAtMeInGroupTalk({ ContentType: 'Text', Content: '@张三' }, '张三')).to.equal(false)
  })

  it('isConversationDigestPinned', () => {
    expect(isConversationDigestPinned({ PinnedKind: 'atme' })).to.equal(true)
    expect(isConversationDigestPinned({})).to.equal(false)
  })

  it('mergeConversationTopFlag：缺字段保留本地乐观置顶；显式字段以手机为准', () => {
    expect(mergeConversationTopFlag({ Digest: 'hi' }, { isTop: true, IsTop: true })).to.equal(true)
    expect(mergeConversationTopFlag({ Digest: 'hi' }, { isTop: false })).to.equal(false)
    expect(mergeConversationTopFlag({ isTop: true }, { isTop: false })).to.equal(true)
    expect(mergeConversationTopFlag({ isTop: false }, { isTop: true, IsTop: true })).to.equal(false)
    expect(mergeConversationTopFlag({ IsTop: 1 }, { isTop: false })).to.equal(true)
  })

  it('buildPinnedDigest 从摘要文本识别红包/转账', () => {
    expect(buildPinnedDigest({ ContentType: 'Text', MsgRemoteId: '1' }, '发了[红包]', false))
      .to.include({ PinnedKind: 'redpacket' })
    expect(buildPinnedDigest({ ContentType: 'Text', MsgRemoteId: '2' }, '收到[转账]', false))
      .to.include({ PinnedKind: 'transfer' })
  })

  it('mergeConversationUnreadCnt 本地累加不被省略字段抹掉', () => {
    expect(mergeConversationUnreadCnt({ Digest: 'x' }, { UnreadCnt: 3 })).to.equal(3)
    expect(mergeConversationUnreadCnt({ UnreadCnt: 0, UpdateTime: 50 }, { UnreadCnt: 2, UpdateTime: 100 }))
      .to.equal(2)
    expect(mergeConversationUnreadCnt({ UnreadCnt: 2, UpdateTime: 200 }, { UnreadCnt: 0, UpdateTime: 100 }))
      .to.equal(2)
  })

  it('clearAtMePinFields 清除 @我 钉住', () => {
    const next = clearAtMePinFields({ PinnedKind: 'atme', PinnedDigest: '[有人@你]', AtCount: 1 })
    expect(next.PinnedKind).to.equal(undefined)
    expect(next.AtCount).to.equal(0)
  })

  it('buildPinnedDigest 无 message 返回 null', () => {
    expect(buildPinnedDigest(null, 'hi', false)).to.equal(null)
  })

  it('mergeConversationUnreadCnt 已读后同时间戳滞后帧不复活角标', () => {
    expect(
      mergeConversationUnreadCnt(
        { UnreadCnt: 2, UpdateTime: 100 },
        { UnreadCnt: 0, UpdateTime: 100, ReadAt: 99 }
      )
    ).to.equal(0)
  })
})
