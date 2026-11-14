import { expect } from 'chai'
import { isSuperAdminFromState } from '@/utils/superAdmin'

function b64url(obj) {
  const json = JSON.stringify(obj)
  const b64 = Buffer.from(json, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fakeJwt(payload) {
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`
}

describe('isSuperAdminFromState', () => {
  it('adminInfo.type=-1 为超管', () => {
    expect(isSuperAdminFromState({ type: -1 }, '')).to.equal(true)
    expect(isSuperAdminFromState({ type: '-1' }, '')).to.equal(true)
  })

  it('adminInfo.type=0 为公司管理员，不回退 JWT', () => {
    expect(isSuperAdminFromState({ type: 0 }, fakeJwt({ type: -1 }))).to.equal(false)
  })

  it('adminInfo.type 缺失时回退 JWT type', () => {
    expect(isSuperAdminFromState({}, fakeJwt({ type: -1 }))).to.equal(true)
    expect(isSuperAdminFromState(null, fakeJwt({ type: -1 }))).to.equal(true)
    expect(isSuperAdminFromState({}, fakeJwt({ type: 0 }))).to.equal(false)
  })
})
