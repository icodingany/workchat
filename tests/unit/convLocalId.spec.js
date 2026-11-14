import { expect } from 'chai'
import { preferSafeConvLocalId } from '@/utils/wechat'

/**
 * 回归：会话 LocalId 超大 int64 经 Number() 丢精度后 TriggerHistory 失败，历史空白。
 * 例：9007199254740993 → Number → 9007199254740992
 */
describe('preferSafeConvLocalId (history LocalId fidelity)', () => {
  const FULL = '9007199254740993'
  const ROUNDED = String(Number(FULL))

  it('Number 会丢失演示联系人会话 LocalId 低位', () => {
    expect(ROUNDED).to.not.equal(FULL)
    expect(ROUNDED).to.equal('9007199254740992')
  })

  it('prev 完整、next 已舍入时保留 prev', () => {
    expect(preferSafeConvLocalId(FULL, ROUNDED)).to.equal(FULL)
  })

  it('prev 空时用 next', () => {
    expect(preferSafeConvLocalId('', FULL)).to.equal(FULL)
    expect(preferSafeConvLocalId('0', FULL)).to.equal(FULL)
  })

  it('两者相同直接返回', () => {
    expect(preferSafeConvLocalId(FULL, FULL)).to.equal(FULL)
  })
})
