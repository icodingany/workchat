import { expect } from 'chai'
import base64 from '@/utils/base64'
import { applyDownloadUrlToMsgContent, markMessageResourceFetchFailed, RESOURCE_FETCH_FAIL_MSG } from '@/utils/downloadFileDetail'
import { sameId } from '@/utils/wechat'

describe('applyDownloadUrlToMsgContent', () => {
  const cdn = 'https://file.example.invalid/20260728/demo.mp4'

  it('HTTP 明文 JSON：写入 url 且保持明文', () => {
    const raw = JSON.stringify({
      url: '/storage/emulated/0/Pictures/SCRM/demo.mp4',
      thumbUrl: 'https://file.example.invalid/thumb.jpg'
    })
    const { content, ok } = applyDownloadUrlToMsgContent(raw, cdn)
    expect(ok).to.equal(true)
    expect(content.trim().startsWith('{')).to.equal(true)
    const obj = JSON.parse(content)
    expect(obj.url).to.equal(cdn)
    expect(obj.thumbUrl).to.include('thumb.jpg')
  })

  it('WS base64 Content：写入 url 且保持 base64', () => {
    const plain = JSON.stringify({ url: '/local/a.mp4', thumbUrl: 'https://x/t.jpg' })
    const raw = base64.encode(plain)
    const { content, ok } = applyDownloadUrlToMsgContent(raw, cdn)
    expect(ok).to.equal(true)
    expect(content.trim().startsWith('{')).to.equal(false)
    const obj = JSON.parse(base64.decode(content))
    expect(obj.url).to.equal(cdn)
  })

  it('旧逻辑对明文 JSON 做 base64.decode 会失败（回归）', () => {
    const raw = JSON.stringify({ url: '/local/a.mp4', thumbUrl: 'https://x/t.jpg' })
    let threw = false
    try {
      JSON.parse(base64.decode(raw))
    } catch (e) {
      threw = true
    }
    expect(threw).to.equal(true)
  })

  it('MsgId number/string 需用 sameId 才能命中', () => {
    expect(123 === '123').to.equal(false)
    expect(sameId(123, '123')).to.equal(true)
  })
})

describe('markMessageResourceFetchFailed', () => {
  it('命中消息时写入 _resourceFetchError 并清除 __decodedHtml', () => {
    const messages = [{ MsgId: 100, Content: 'x', __decodedHtml: '<img/>' }]
    const next = markMessageResourceFetchFailed(messages, '100')
    expect(next).not.to.equal(null)
    expect(next[0]._resourceFetchError).to.equal(RESOURCE_FETCH_FAIL_MSG)
    expect(next[0].__decodedHtml).to.equal(undefined)
  })

  it('未命中返回 null', () => {
    expect(markMessageResourceFetchFailed([{ MsgId: 1 }], 999)).to.equal(null)
  })
})

describe('applyDownloadUrlToMsgContent 边界', () => {
  it('空 url 或空 content 返回 ok:false', () => {
    expect(applyDownloadUrlToMsgContent('', 'http://x').ok).to.equal(false)
    expect(applyDownloadUrlToMsgContent('{"url":"a"}', '').ok).to.equal(false)
  })

  it('非 JSON 内容返回 ok:false', () => {
    const { ok } = applyDownloadUrlToMsgContent('not-json', 'http://cdn/x')
    expect(ok).to.equal(false)
  })

  it('JSON 原始值非 object 返回 ok:false', () => {
    const { ok } = applyDownloadUrlToMsgContent(JSON.stringify(123), 'http://cdn/x')
    expect(ok).to.equal(false)
  })
})
