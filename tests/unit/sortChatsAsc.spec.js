/**
 * sortChatsAsc 与 store/modules/conversation.js 导出保持一致（无法直接 import 该模块）。
 * 变更 conversation.js 内排序逻辑时须同步本文件。
 */
import { expect } from 'chai'

function normalizeMsgTimeMs(t) {
  if (t === null || t === undefined || t === '') return 0
  let n = Number(t)
  if (!Number.isFinite(n)) {
    const parsed = Date.parse(t)
    n = Number.isFinite(parsed) ? parsed : 0
  }
  if (n > 0 && n < 1e12) n *= 1000
  return n
}

function sortChatsAsc(a, b) {
  const ta = normalizeMsgTimeMs(a && (a.MsgTime != null ? a.MsgTime : a.CreateTime))
  const tb = normalizeMsgTimeMs(b && (b.MsgTime != null ? b.MsgTime : b.CreateTime))
  if (ta !== tb) return ta - tb
  const ra = Number(a && a.MsgRemoteId) || 0
  const rb = Number(b && b.MsgRemoteId) || 0
  if (ra !== rb) return ra - rb
  const ma = Number(a && a.MsgId) || 0
  const mb = Number(b && b.MsgId) || 0
  if (ma !== mb) return ma - mb
  const ia = Number(a && a.id) || 0
  const ib = Number(b && b.id) || 0
  return ia - ib
}

describe('sortChatsAsc（消息时间排序）', () => {
  it('按 MsgTime 秒级升序', () => {
    const a = { MsgTime: 100, MsgRemoteId: '1' }
    const b = { MsgTime: 200, MsgRemoteId: '2' }
    expect(sortChatsAsc(a, b)).to.be.below(0)
    expect(sortChatsAsc(b, a)).to.be.above(0)
  })

  it('同时间按 MsgRemoteId', () => {
    const a = { CreateTime: 100, MsgRemoteId: '10' }
    const b = { CreateTime: 100, MsgRemoteId: '20' }
    expect(sortChatsAsc(a, b)).to.be.below(0)
  })

  it('毫秒时间归一后排序', () => {
    const a = { CreateTime: 1000 }
    const b = { CreateTime: 2000000 }
    expect(sortChatsAsc(a, b)).to.be.below(0)
  })
})
