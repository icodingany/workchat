import { expect } from 'chai'
import { resolveFetchAuthHeaders } from '@/utils/fetchTokenRouting'

describe('fetchTokenRouting', () => {
  const http = 'jwt-http-token'
  const ws = 'ws-channel-token'

  it('/user/** 只用 httpToken', () => {
    const h = resolveFetchAuthHeaders('/user/message/pageList', { httpToken: http, validateToken: ws })
    expect(h.Authorization).to.equal(`Bearer ${http}`)
    expect(h.token).to.equal(http)
  })

  it('/admin/** 只用 httpToken', () => {
    const h = resolveFetchAuthHeaders('/admin/device/pageList', { httpToken: http, validateToken: ws })
    expect(h.Authorization).to.equal(`Bearer ${http}`)
    expect(h.token).to.equal(http)
  })

  it('/api/regcode/** 只用 httpToken', () => {
    const h = resolveFetchAuthHeaders('/api/regcode/pageList', { httpToken: http, validateToken: ws })
    expect(h.Authorization).to.equal(`Bearer ${http}`)
    expect(h.token).to.equal(http)
  })

  it('/pc/** 优先 httpToken，无则回退 validateToken', () => {
    expect(resolveFetchAuthHeaders('/pc/foo', { httpToken: http, validateToken: ws }).Authorization).to.equal(
      `Bearer ${http}`
    )
    expect(resolveFetchAuthHeaders('/pc/foo', { validateToken: ws }).Authorization).to.equal(`Bearer ${ws}`)
    expect(resolveFetchAuthHeaders('/pc/foo', {})).to.deep.equal({})
  })

  it('无 token 时不带头', () => {
    expect(resolveFetchAuthHeaders('/user/account/pageList', {})).to.deep.equal({})
  })
})
