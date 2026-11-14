import { expect } from 'chai'
import { parseHttpTokenPayload, typeFromHttpToken } from '@/utils/httpTokenClaims'

function b64url(obj) {
  const json = JSON.stringify(obj)
  const b64 = Buffer.from(json, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fakeJwt(payload) {
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`
}

describe('httpTokenClaims', () => {
  it('parseHttpTokenPayload 读出 type/sub', () => {
    const token = fakeJwt({ sub: 'root', type: -1, userId: 1 })
    const p = parseHttpTokenPayload(token)
    expect(p.sub).to.equal('root')
    expect(p.type).to.equal(-1)
  })

  it('typeFromHttpToken 兼容字符串 "-1"', () => {
    expect(typeFromHttpToken(fakeJwt({ type: '-1' }))).to.equal(-1)
    expect(typeFromHttpToken(fakeJwt({ type: 0 }))).to.equal(0)
    expect(typeFromHttpToken('')).to.equal(null)
    expect(typeFromHttpToken(null)).to.equal(null)
  })

  it('非法 JWT 返回 null', () => {
    expect(parseHttpTokenPayload('not.a.jwt')).to.equal(null)
    expect(parseHttpTokenPayload('a.b')).to.equal(null)
    expect(typeFromHttpToken('broken')).to.equal(null)
  })
})
