import { expect } from 'chai'
import {
  mapAutoReplyRowToChat,
  decodeAutoReplyHtml,
  normalizeAutoReplyVoiceUrl
} from '@/utils/autoReplyPreview'

describe('autoReplyPreview', () => {
  it('Text 行映射并渲染', () => {
    const html = decodeAutoReplyHtml({ resourceType: 1, returnString: '您好，请问有什么可以帮您？' })
    expect(html).to.include('您好')
  })

  it('Picture 行输出 img', () => {
    const html = decodeAutoReplyHtml({
      resourceType: 2,
      returnString: 'https://cdn.example.com/reply.jpg'
    })
    expect(html).to.include('<img')
    expect(html).to.include('https://cdn.example.com/reply.jpg')
  })

  it('Voice amr 转 mp3', () => {
    expect(normalizeAutoReplyVoiceUrl('https://x/a.amr?duration=2')).to.equal('https://x/a.mp3')
    const chat = mapAutoReplyRowToChat({ resourceType: 3, returnString: 'https://x/a.amr?duration=2' })
    expect(chat.Content).to.equal('https://x/a.mp3')
  })

  it('Link JSON 解析 jContent 并 escape 标题', () => {
    const html = decodeAutoReplyHtml({
      resourceType: 6,
      returnString: JSON.stringify({ title: '<b>促销</b>', desc: '详情', thumbUrl: 'https://cdn/t.jpg' })
    })
    expect(html).to.include('&lt;b&gt;促销&lt;/b&gt;')
    expect(html).to.include('link-title')
  })

  it('WeApp JSON 渲染小程序结构', () => {
    const html = decodeAutoReplyHtml({
      resourceType: 13,
      returnString: JSON.stringify({
        iconUrl: 'https://cdn/icon.png',
        appName: '演示小程序',
        title: '标题',
        thumbUrl: 'https://cdn/thumb.jpg'
      })
    })
    expect(html).to.include('app-typestr')
    expect(html).to.include('演示小程序')
  })

  it('未知类型走 decodeChatHtml default', () => {
    const html = decodeAutoReplyHtml({ resourceType: 99, returnString: 'x' })
    expect(html).to.include('x')
  })
})
