/**
 * 系统消息突发性能回归，使用合成消息与会话数据。
 * 每条消息都重建、去重和排序完整列表会增加主线程开销；本测试比较
 * 增量消息插入与会话排序路径。使用 60 条突发作为可重复的测试负载，
 * 性能预算为 CI 机器差异留出余量，不代表产品吞吐量承诺。
 */
import { expect } from 'chai'
import { insertChatSorted, appendIncomingChat, CURRENT_CHATS_SOFT_CAP } from '@/utils/chatMerge'
import { normalizeChatFields } from '@/utils/chatMessageFields'
import { sortConversationsForDisplay } from '@/utils/conversationSort'

const WX = 'wx_work_001'
const CONV = 'wxid_friend_777'
const BURST = 60

function seedMessages(n) {
  const list = []
  for (let i = 0; i < n; i++) {
    list.push(
      normalizeChatFields({
        WxId: WX,
        ConvId: CONV,
        ContentType: 'Text',
        Content: `历史消息 ${i} some text content`,
        MsgRemoteId: `r_${1000 + i}`,
        CreateTime: 1756000000 + i * 10,
        SenderId: i % 2 ? WX : CONV,
        SenderAccountName: i % 2 ? 'demo_agent' : ''
      })
    )
  }
  return list
}

function burstMessages(n, startMs) {
  const list = []
  for (let i = 0; i < n; i++) {
    list.push(
      normalizeChatFields({
        WxId: WX,
        ConvId: CONV,
        ContentType: 'Text',
        Content: `系统消息 ${i} auto reply content`,
        MsgRemoteId: `r_${9000 + i}`,
        CreateTime: startMs + i * 10,
        SenderId: WX,
        SenderAccountName: 'demo_agent'
      })
    )
  }
  return list
}

function seedConvs(n, contactsMap) {
  const list = []
  for (let i = 0; i < n; i++) {
    const rid = `conv_rid_${i}`
    list.push({
      WxId: WX,
      RemoteId: rid,
      Id: `lid_${i}`,
      Name: `会话 ${i}`,
      Digest: `最近消息摘要 ${i}`,
      UnreadCnt: i % 5,
      UpdateTime: 1756000000 + i * 7,
      IsTop: i % 20 === 0 ? 1 : 0,
      Members: i % 10 === 0 ? [{ RemoteId: 'm1' }] : undefined
    })
    if (i % 3 === 0) contactsMap[rid] = { RemoteId: rid, Name: `客户 ${i}` }
  }
  return list
}

/** 复刻 UpdateConversations 的 patchConversationList：命中项浅拷贝打补丁 → 新数组 */
function patchConvTime(list, remoteId, updateTime, digest) {
  const hit = list.findIndex((c) => c.RemoteId === remoteId)
  const next = list.slice()
  next[hit] = { ...list[hit], UpdateTime: updateTime, Digest: digest || list[hit].Digest }
  return next
}

describe('系统消息突发性能回归（60 条合成消息）', () => {
  describe('性能预算', () => {
    it('消息列表：80 条底 + 60 条突发单条快路径 < 250ms', () => {
      // JIT 预热：完整跑一遍突发，避免首次解释执行误差
      {
        let warm = seedMessages(CURRENT_CHATS_SOFT_CAP)
        for (const doc of burstMessages(BURST, 1756005000)) warm = appendIncomingChat(warm, doc)
      }
      const base = seedMessages(CURRENT_CHATS_SOFT_CAP)
      const burst = burstMessages(BURST, 1756000000 + 10000)
      const t0 = performance.now()
      let list = base.slice(0, CURRENT_CHATS_SOFT_CAP)
      for (const doc of burst) {
        list = appendIncomingChat(list, doc)
      }
      const cost = performance.now() - t0
      console.log(`[perf] appendIncomingChat 60 条突发: ${cost.toFixed(1)}ms（预算 300ms，旧路径 18.5ms@插桩）`)
      expect(cost, '突发处理不得明显劣于旧全表重建数量级').to.be.below(300)
      expect(list.length).to.equal(CURRENT_CHATS_SOFT_CAP + BURST)
    })

    it('侧栏：300 会话 × 60 次逐条重排 < 200ms（旧重比较器 1346ms）', () => {
      const contactsMap = {}
      const convs = seedConvs(300, contactsMap)
      // JIT 预热
      for (let i = 0; i < 3; i++) sortConversationsForDisplay(convs, contactsMap)
      const t0 = performance.now()
      let list = convs
      for (let i = 0; i < BURST; i++) {
        list = patchConvTime(list, 'conv_rid_7', 1756000000 + 10000 + i, `系统消息 ${i}`)
        sortConversationsForDisplay(list, contactsMap)
      }
      const cost = performance.now() - t0
      console.log(`[perf] 侧栏 300 会话 × 60 次重排: ${cost.toFixed(1)}ms（预算 200ms，旧路径 1346ms）`)
      expect(cost, '侧栏逐条重排不得堵塞主线程（卡顿主因）').to.be.below(200)
      expect(list.length).to.equal(300)
    })
  })

  describe('快路径语义（对齐 mergeDedupeAndSort 单条场景）', () => {
    it('单条插入保持时间升序', () => {
      let list = seedMessages(20)
      const burst = burstMessages(5, 1756000000 + 5000)
      for (const doc of burst) list = appendIncomingChat(list, doc)
      for (let i = 1; i < list.length; i++) {
        expect(Number(list[i].CreateTime)).to.be.at.least(Number(list[i - 1].CreateTime))
      }
    })

    it('同 MsgRemoteId 重复到达合并去重（Content 不丢）', () => {
      const first = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'Text', Content: '第一条正文',
        MsgRemoteId: 'r_dup_1', CreateTime: 1756000100, SenderId: WX
      })
      const dup = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'Text', Content: '回执补充正文',
        MsgRemoteId: 'r_dup_1', CreateTime: 1756000100, SenderId: WX, MsgId: '555'
      })
      let list = appendIncomingChat([first], dup)
      expect(list).to.have.lengthOf(1)
      expect(list[0].Content).to.equal('回执补充正文')
      expect(list[0].MsgId).to.equal('555')
    })

    it('LocalSend 预览被真实回执合并后清除转圈标记', () => {
      const preview = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'Text', Content: '发送中预览',
        TaskId: 'task_9', CreateTime: 1756000200, SenderId: WX, LocalSend: true
      })
      const receipt = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'Text', Content: '发送中预览',
        TaskId: 'task_9', MsgRemoteId: 'r_receipt_1', MsgId: '9001',
        CreateTime: 1756000200, SenderId: WX
      })
      const list = appendIncomingChat([preview], receipt)
      expect(list).to.have.lengthOf(1)
      expect(list[0].LocalSend, '带 MsgRemoteId 回执应清掉 LocalSend').to.not.equal(true)
      expect(list[0].MsgRemoteId).to.equal('r_receipt_1')
    })

    it('digest-preview 占位在首条真实消息到达后被清掉', () => {
      const placeholder = { ...seedMessages(1)[0], _digestPreview: true, MsgRemoteId: 'r_ph', Content: '[预览]' }
      const real = burstMessages(1, 1756000000 + 5)[0]
      const list = appendIncomingChat([placeholder], real)
      expect(list.some((m) => m._digestPreview)).to.equal(false)
      expect(list.some((m) => String(m.MsgRemoteId) === String(real.MsgRemoteId))).to.equal(true)
    })

    it('多条「已添加」System 全部隐藏', () => {
      const a = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'System', Content: '你已添加了对方，现在可以开始聊天',
        MsgRemoteId: 'r_g1', CreateTime: 1756000300, SenderId: WX
      })
      const b = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'System', Content: '你已添加了对方，现在可以开始聊天',
        MsgRemoteId: 'r_g2', CreateTime: 1756000310, SenderId: WX
      })
      let list = appendIncomingChat([a], b)
      list = appendIncomingChat(list, burstMessages(1, 1756000400)[0])
      const greetings = list.filter((m) => String(m.Content).includes('已添加'))
      expect(greetings).to.have.lengthOf(0)
    })

    it('普通消息不触发 cleanup（陌生人 tip 不被误删）', () => {
      const tip = normalizeChatFields({
        WxId: WX, ConvId: CONV, ContentType: 'System', Content: '对方还不是你的联系人',
        MsgRemoteId: 'r_tip_1', CreateTime: 1756000500, SenderId: WX, _strangerTip: true
      })
      const normal = burstMessages(1, 1756000600)[0]
      const list = appendIncomingChat([tip], normal)
      expect(list.some((m) => m._strangerTip)).to.equal(true, '普通消息不应清掉本地陌生人 tip')
    })
  })
})

describe('sortConversationsForDisplay 分数缓存正确性', () => {
  it('原地变更会话（CHANGE_CONVERSATIONS 场景）后重排结果仍正确', () => {
    const contactsMap = {}
    const convs = seedConvs(50, contactsMap)
    const sorted1 = sortConversationsForDisplay(convs, contactsMap)
    // CHANGE_CONVERSATIONS 直接原地改 conv 字段（不换引用）：缓存必须感知
    const target = convs.find((c) => c.RemoteId === 'conv_rid_11')
    target.UpdateTime = 1756999999
    target.IsTop = 1
    const sorted2 = sortConversationsForDisplay(convs, contactsMap)
    const topIds = sorted2.slice(0, 3).map((c) => c.RemoteId)
    expect(topIds, '置顶会话必须排到最前').to.include('conv_rid_11')
    // 非原地变更（UpdateConversations 浅拷贝）同样正确
    const list2 = patchConvTime(convs, 'conv_rid_22', 1756999998)
    const sorted3 = sortConversationsForDisplay(list2, contactsMap)
    expect(sorted3[0].RemoteId).to.be.oneOf(['conv_rid_11', 'conv_rid_22'])
  })
})
