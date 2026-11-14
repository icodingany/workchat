import { expect } from 'chai'
import { resolveOutgoingResendContent } from '@/utils/outgoingResendContent'

describe('resolveOutgoingResendContent', () => {
  it('Picture 本地占位 JSON 提取纯 URL（重发不能把 JSON 当下载地址）', () => {
    const decoded = JSON.stringify({
      Thumb: 'https://file.example.invalid/wework/20260825/a.jpg',
      url: 'https://file.example.invalid/wework/20260825/a.jpg'
    })
    expect(resolveOutgoingResendContent('Picture', decoded)).to.equal(
      'https://file.example.invalid/wework/20260825/a.jpg'
    )
    expect(resolveOutgoingResendContent(2, decoded)).to.equal(
      'https://file.example.invalid/wework/20260825/a.jpg'
    )
  })

  it('Picture 已是纯 URL 原样返回', () => {
    const url = 'https://file.example.invalid/wework/20260825/b.jpg'
    expect(resolveOutgoingResendContent('Picture', url)).to.equal(url)
  })

  it('Video 占位 JSON 提取 url', () => {
    const decoded = JSON.stringify({
      thumbUrl: 'https://file.example.invalid/wework/20260825/v.jpg',
      url: 'https://file.example.invalid/wework/20260825/v.mp4'
    })
    expect(resolveOutgoingResendContent('Video', decoded)).to.equal(
      'https://file.example.invalid/wework/20260825/v.mp4'
    )
  })

  it('Text / File 不改写', () => {
    expect(resolveOutgoingResendContent('Text', '你好')).to.equal('你好')
    const fileJson = JSON.stringify({ name: 'a.pdf', url: 'https://cdn/a.pdf' })
    expect(resolveOutgoingResendContent('File', fileJson)).to.equal(fileJson)
  })
})
