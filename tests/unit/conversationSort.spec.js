import { expect } from 'chai'
import {
  calculateSortScore,
  isNonFriendConversation,
  isStrangerContactDigest,
  pickConversationDigest,
  sortConversationsForDisplay,
  getConversationContactStatus,
  isGroupConversation,
  SORT_PRIORITY_TOP,
  SORT_PRIORITY_UNREAD,
  ONE_WAY_SINK_WEIGHT,
  EXTERNAL_SINK_WEIGHT
} from '@/utils/conversationSort'

const T = 1700000001000
const T2 = 1700000002000

describe('conversationSort (align kelailaichatpc)', () => {
  describe('isStrangerContactDigest / pickConversationDigest', () => {
    it('识别「还不是你的联系人」摘要', () => {
      expect(isStrangerContactDigest('示例客户甲还不是你的联系人')).to.equal(true)
      expect(isStrangerContactDigest('你好')).to.equal(false)
    })

    it('挑选 Digest 时跳过陌生人提示并保留已有真实摘要', () => {
      expect(pickConversationDigest('示例客户甲还不是你的联系人', '你好')).to.equal('你好')
      expect(pickConversationDigest('你好', '示例客户甲还不是你的联系人')).to.equal('你好')
      expect(pickConversationDigest('示例客户甲还不是你的联系人', '')).to.equal('')
    })
  })

  describe('isNonFriendConversation', () => {
    it('不在 contactsMap 的私聊视为非好友', () => {
      const conv = { RemoteId: '1001', Name: '示例客户甲' }
      expect(isNonFriendConversation(conv, {})).to.equal(true)
      expect(isNonFriendConversation(conv, { '1001': { Name: '示例客户甲' } })).to.equal(false)
    })

    it('群聊不算非好友', () => {
      const conv = { RemoteId: '2001', Members: [{ RemoteId: '1' }] }
      expect(isNonFriendConversation(conv, {})).to.equal(false)
    })

    it('Digest 为陌生人提示时视为非好友', () => {
      const conv = { RemoteId: '1001', Digest: '示例客户甲还不是你的联系人' }
      expect(isNonFriendConversation(conv, { '1001': { Name: 'x' } })).to.equal(true)
    })

    it('Digest「你已添加了」视为已是好友（通讯录未同步也不沉底/不提示）', () => {
      const conv = {
        RemoteId: '1001',
        Digest: '你已添加了示例客户乙, 现在可以开始聊天了。'
      }
      expect(isNonFriendConversation(conv, {})).to.equal(false)
    })
  })

  describe('calculateSortScore / sortConversationsForDisplay', () => {
    it('置顶优先于时间；未读不抬分', () => {
      const top = calculateSortScore({ IsTop: 1, UnreadCnt: 0, UpdateTime: T })
      const unread = calculateSortScore({ IsTop: 0, UnreadCnt: 3, UpdateTime: T2 })
      expect(top).to.be.greaterThan(unread)
      expect(top).to.equal(SORT_PRIORITY_TOP + T)
      expect(SORT_PRIORITY_UNREAD).to.equal(0)
      expect(unread).to.equal(T2)
    })

    it('非好友无置顶沉底（有未读也不上浮）', () => {
      const normal = calculateSortScore({
        IsTop: 0,
        UnreadCnt: 0,
        UpdateTime: T,
        IsOneWay: 0
      })
      const oneWayUnread = calculateSortScore({
        IsTop: 0,
        UnreadCnt: 2,
        UpdateTime: T,
        IsOneWay: 1
      })
      expect(oneWayUnread).to.be.lessThan(normal)
      expect(normal - oneWayUnread).to.equal(ONE_WAY_SINK_WEIGHT)
    })

    it('列表排序：好友在前、非好友沉底', () => {
      const contactsMap = { '1': { Name: '好友' } }
      const sorted = sortConversationsForDisplay(
        [
          { RemoteId: '9', Name: '非好友', UpdateTime: T2, Digest: '示例客户甲还不是你的联系人' },
          { RemoteId: '1', Name: '好友', UpdateTime: T }
        ],
        contactsMap
      )
      expect(sorted[0].RemoteId).to.equal('1')
      expect(sorted[1].RemoteId).to.equal('9')
    })

    it('免打扰有未读时分数仍仅等于时间', () => {
      const silent = calculateSortScore({
        UnreadCnt: 5,
        Notified: false,
        UpdateTime: T
      })
      expect(silent).to.equal(T)
    })

    it('外部联系人轻量沉底（_isExternal）', () => {
      const friend = calculateSortScore({ UpdateTime: T, IsOneWay: 0 })
      const external = calculateSortScore({ UpdateTime: T, _isExternal: true, IsOneWay: 0 })
      expect(external).to.be.lessThan(friend)
      expect(friend - external).to.equal(EXTERNAL_SINK_WEIGHT)
    })

    it('同分按 RemoteId 字典序', () => {
      const sorted = sortConversationsForDisplay(
        [
          { RemoteId: '2', Name: 'B', UpdateTime: T },
          { RemoteId: '10', Name: 'A', UpdateTime: T }
        ],
        { '2': {}, '10': {} }
      )
      expect(sorted[0].RemoteId).to.equal('10')
      expect(sorted[1].RemoteId).to.equal('2')
    })
  })

  describe('getConversationContactStatus / isGroupConversation', () => {
    it('群聊 Type=1 为 contact', () => {
      expect(isGroupConversation({ Type: 1 })).to.equal(true)
      expect(getConversationContactStatus({ Type: 1, RemoteId: '1' }, {})).to.equal('contact')
    })

    it('联系人 map 命中为 contact', () => {
      expect(getConversationContactStatus({ RemoteId: '100' }, { '100': { Name: 'x' } })).to.equal(
        'contact'
      )
    })

    it('陌生人 Digest 为 stranger；聊过非联系人为 external', () => {
      expect(
        getConversationContactStatus({ RemoteId: '9', Digest: '张三还不是你的联系人' }, {})
      ).to.equal('stranger')
      expect(getConversationContactStatus({ RemoteId: '9', Digest: '你好' }, {})).to.equal('external')
    })
  })
})
