import { expect } from 'chai'
import {
  computeHasMore,
  mergeEarlierMessages,
  shouldPhonePull,
  sleepMs
} from '@/views/admin/components/friendChatPullHelper'

describe('friendChatPullHelper', () => {
  it('computeHasMore: page*rows < total', () => {
    expect(computeHasMore(1, 20, 45)).to.equal(true)
    expect(computeHasMore(3, 20, 45)).to.equal(false)
  })

  it('mergeEarlierMessages: 更早页插到前面并按 MsgId 去重', () => {
    const existing = [{ MsgId: 2, MsgTime: 200 }, { MsgId: 3, MsgTime: 300 }]
    const earlier = [{ MsgId: 1, MsgTime: 100 }, { MsgId: 2, MsgTime: 200 }]
    const merged = mergeEarlierMessages(existing, earlier)
    expect(merged.map((m) => m.MsgId)).to.deep.equal([1, 2, 3])
  })

  it('shouldPhonePull: 仅首屏空且无关键词', () => {
    expect(shouldPhonePull({ page: 1, keyword: '', rows: [] })).to.equal(true)
    expect(shouldPhonePull({ page: 1, keyword: 'hi', rows: [] })).to.equal(false)
    expect(shouldPhonePull({ page: 1, keyword: '', rows: [{ id: 1 }] })).to.equal(false)
  })

  it('sleepMs resolves', async () => {
    const t0 = Date.now()
    await sleepMs(20)
    expect(Date.now() - t0).to.be.at.least(15)
  })
})
