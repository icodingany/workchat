import { expect } from 'chai'
import { isContentType } from '@/utils/chatMessageFields'
import { chatContentClasses, isHiddenAvatarContentType, isSystemContentType } from '@/utils/chatContentClasses'

describe('isContentType / chatContentClasses', () => {
  it('数字与枚举名等价', () => {
    expect(isContentType(2, 'Picture')).to.equal(true)
    expect(isContentType('Picture', 2)).to.equal(true)
    expect(isContentType(1, 'Text')).to.equal(true)
  })

  it('chatContentClasses 不依赖模板内 || 数字', () => {
    const cls = chatContentClasses(2)
    expect(cls['chat-picture']).to.equal(true)
    expect(cls['chat-voice']).to.equal(false)
  })

  it('isHiddenAvatarContentType 覆盖 System 系', () => {
    expect(isHiddenAvatarContentType(5)).to.equal(true)
    expect(isHiddenAvatarContentType('Text')).to.equal(false)
    expect(isSystemContentType(16)).to.equal(true)
  })
})
