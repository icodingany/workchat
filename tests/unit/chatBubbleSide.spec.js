import { expect } from 'chai'
import { sameWxId } from '@/utils/wechat'

/**
 * 回归：刷新后 HTTP 历史 SenderId 为 number、currentWeChatId 为 string。
 * ShowChats 左右气泡必须用 sameWxId，不能用 ===。
 */
describe('chat bubble side (SenderId vs currentWeChatId)', () => {
  const wxId = '8000000000010001'

  it('严格 === 在 number/string 混用时失败（刷新后全靠左的根因）', () => {
    expect(Number(wxId) === wxId).to.equal(false)
  })

  it('sameWxId 归一后己方消息能判为右侧', () => {
    expect(sameWxId(Number(wxId), wxId)).to.equal(true)
  })

  it('对方 SenderId 仍判为非己方', () => {
    expect(sameWxId(800000000190019, wxId)).to.equal(false)
  })
})
