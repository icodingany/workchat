import { expect } from 'chai'
import { reactive } from 'vue'
import {
  buildLocalChatDocId,
  buildSessionChatIdPrefix,
  toPlainForIdb
} from '@/utils/historyChatLocalPersist'

describe('historyChatLocalPersist', () => {
  it('有 MsgRemoteId 时生成 svr id', () => {
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '99', 'm1')).to.equal('u1|w1|c1|svr_99')
  })
  it('无 Remote 用 MsgId', () => {
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '', 'm1')).to.equal('u1|w1|c1|msg_m1')
  })
  it('无有效 id 返回 null', () => {
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '', '')).to.equal(null)
  })
  it('仅有 TaskId（发送失败预览）生成 task id，使其可持久化恢复', () => {
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '', '', 'task_123')).to.equal(
      'u1|w1|c1|task_task_123'
    )
  })
  it('TaskId 为 0/空 时不生成 task id（回退 null）', () => {
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '', '', '0')).to.equal(null)
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '', '', '')).to.equal(null)
  })
  it('有 MsgRemoteId 时 TaskId 不参与（svr 优先）', () => {
    expect(buildLocalChatDocId('u1', 'w1', 'c1', '99', '', 'task_1')).to.equal('u1|w1|c1|svr_99')
  })
  it('session 前缀', () => {
    expect(buildSessionChatIdPrefix('u1', 'w1', 'c1')).to.equal('u1|w1|c1|')
  })

  it('toPlainForIdb：Vue reactive Proxy 转成可 structuredClone 的纯对象', () => {
    const proxyMsg = reactive({
      MsgId: '1',
      MsgRemoteId: '99',
      Content: 'hello',
      CreateTime: 1000,
      nested: { a: 1 }
    })
    let proxyCloneFailed = false
    try {
      structuredClone(proxyMsg)
    } catch (e) {
      proxyCloneFailed = e && (e.name === 'DataCloneError' || /could not be cloned/i.test(String(e.message)))
    }
    const plain = toPlainForIdb(proxyMsg)
    expect(plain).to.deep.equal({
      MsgId: '1',
      MsgRemoteId: '99',
      Content: 'hello',
      CreateTime: 1000,
      nested: { a: 1 }
    })
    expect(() => structuredClone(plain)).to.not.throw()
    if (proxyCloneFailed) {
      expect(plain).to.not.equal(proxyMsg)
    }
  })

  it('toPlainForIdb：剥离函数字段后仍可 clone', () => {
    const dirty = {
      MsgId: '2',
      Content: 'x',
      CreateTime: 1,
      onClick: () => {}
    }
    const plain = toPlainForIdb(dirty)
    expect(plain.onClick).to.equal(undefined)
    expect(plain.Content).to.equal('x')
    expect(() => structuredClone(plain)).to.not.throw()
  })
})
