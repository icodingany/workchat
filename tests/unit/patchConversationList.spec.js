/**
 * SetConvReaded / patchConversationList：避免 JSON 深拷贝整表。
 */
import { describe, it, expect } from 'vitest'
import { clearAtMePinFields } from '@/utils/conversationDigest'

/**
 * 与 store 内 patchConversationList 同语义的本地副本（单测不挂 Vuex）
 */
function patchConversationList(list, match, patch) {
  if (!Array.isArray(list) || !list.length) return null
  let hit = -1
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      hit = i
      break
    }
  }
  if (hit < 0) return null
  const next = list.slice()
  next[hit] = patch({ ...list[hit] })
  return next
}

describe('patchConversationList（会话已读浅更新）', () => {
  it('只改命中项，其它项保持引用', () => {
    const a = { RemoteId: '1', Name: 'A', UnreadCnt: 3, Members: [{ id: 1 }] }
    const b = { RemoteId: '2', Name: 'B', UnreadCnt: 1, Members: [{ id: 2 }] }
    const list = [a, b]
    const next = patchConversationList(
      list,
      (c) => c.RemoteId === '1',
      (c) => {
        c.UnreadCnt = 0
        c.AtCount = 0
        c.ReadAt = 1
        return clearAtMePinFields(c)
      }
    )
    expect(next).not.toBeNull()
    expect(next[0].UnreadCnt).toBe(0)
    expect(next[0]).not.toBe(a)
    expect(next[1]).toBe(b) // 未命中项引用不变
    expect(a.UnreadCnt).toBe(3) // 原对象未原地改写
  })

  it('未命中返回 null', () => {
    const list = [{ RemoteId: '9', UnreadCnt: 1 }]
    expect(patchConversationList(list, (c) => c.RemoteId === '1', (c) => c)).toBeNull()
  })

  it('大列表浅更新应远快于 JSON 深拷贝', () => {
    const list = Array.from({ length: 800 }, (_, i) => ({
      RemoteId: String(i),
      Name: `n${i}`,
      Digest: 'x'.repeat(200),
      Members: i % 5 === 0 ? Array.from({ length: 20 }, (_, j) => ({ id: j, n: 'm' })) : undefined,
      UnreadCnt: i === 400 ? 5 : 0
    }))

    const tDeep0 = performance.now()
    const deep = JSON.parse(JSON.stringify(list))
    deep[400].UnreadCnt = 0
    const deepMs = performance.now() - tDeep0

    const tShallow0 = performance.now()
    const shallow = patchConversationList(
      list,
      (c) => c.RemoteId === '400',
      (c) => {
        c.UnreadCnt = 0
        return c
      }
    )
    const shallowMs = performance.now() - tShallow0

    expect(shallow[400].UnreadCnt).toBe(0)
    // 允许环境抖动：浅更新至少应不慢于深拷贝的一半（通常快一个数量级）
    expect(shallowMs).toBeLessThan(Math.max(deepMs * 0.5, 5))
  })
})
