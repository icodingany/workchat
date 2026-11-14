import { expect } from 'chai'
import {
  validatePageListRow,
  validatePageListResponse
} from '../../../scripts/api-smoke/pageListContract.js'

describe('api-smoke pageListContract', () => {
  it('contentType:null + ContentType 有效 → 报契约问题', () => {
    const issues = validatePageListRow({
      contentType: null,
      ContentType: '1',
      content: '你好'
    })
    expect(issues.length).to.be.greaterThan(0)
    expect(issues[0]).to.include('contentType:null')
  })

  it('仅 ContentType PascalCase → 通过', () => {
    const issues = validatePageListRow({
      ContentType: '1',
      Content: '你好',
      WxId: '123'
    })
    expect(issues).to.deep.equal([])
  })

  it('空 rows → 通过（无会话消息）', () => {
    const r = validatePageListResponse({ code: 0, data: { rows: [], records: 0 } })
    expect(r.ok).to.equal(true)
    expect(r.empty).to.equal(true)
  })

  it('整页响应批量校验', () => {
    const r = validatePageListResponse({
      code: 0,
      data: {
        records: 1,
        rows: [{ ContentType: '1', content: 'ok' }]
      }
    })
    expect(r.ok).to.equal(true)
    expect(r.rowCount).to.equal(1)
  })
})
