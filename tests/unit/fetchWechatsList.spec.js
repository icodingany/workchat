import { expect } from 'chai'
import { resolvePcAccountId } from '@/api/httpApi'

describe('resolvePcAccountId', () => {
  it('reads UnionId from currentUser object', () => {
    expect(resolvePcAccountId({ UnionId: 42 })).to.equal(42)
    expect(resolvePcAccountId({ unionId: '99' })).to.equal(99)
  })

  it('falls back to id fields', () => {
    expect(resolvePcAccountId({ id: 7 })).to.equal(7)
    expect(resolvePcAccountId(15)).to.equal(15)
  })

  it('rejects invalid ids', () => {
    expect(resolvePcAccountId(null)).to.equal(null)
    expect(resolvePcAccountId(0)).to.equal(null)
    expect(resolvePcAccountId('abc')).to.equal(null)
  })
})
