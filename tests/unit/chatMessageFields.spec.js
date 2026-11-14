import { expect } from 'chai'
import base64 from '@/utils/base64'
import {
  normalizeChatFields,
  normalizeContentType,
  inferContentTypeFromBody,
  shouldSkipEmptyIncomingChat,
  isResolvableEmptyMedia,
  pickChatField,
  resolveChatContent
} from '@/utils/chatMessageFields'

describe('chatMessageFields', () => {
  it('HTTP camelCase 归一为 PascalCase', () => {
    const m = normalizeChatFields({
      contentType: '1',
      content: '你好',
      msgId: '9'
    })
    expect(m.ContentType).to.equal('Text')
    expect(m.Content).to.equal('你好')
    expect(m.MsgId).to.equal('9')
  })

  it('WS camelCase wxId/convId 归一', () => {
    const m = normalizeChatFields({
      wxId: 'wx_abc',
      convId: 'conv_123',
      msgRemoteId: '999',
      contentType: 1,
      content: 'hi'
    })
    expect(m.WxId).to.equal('wx_abc')
    expect(m.ConvId).to.equal('conv_123')
    expect(m.MsgRemoteId).to.equal('999')
    expect(m.ContentType).to.equal('Text')
  })

  it('缺 ContentType 时按正文推断为 Text', () => {
    const m = normalizeChatFields({ content: 'ORD80000000000060006' })
    expect(m.ContentType).to.equal('Text')
    expect(m.Content).to.equal('ORD80000000000060006')
  })

  it('数字 ContentType 映射枚举名', () => {
    expect(normalizeContentType(2)).to.equal('Picture')
    expect(normalizeContentType('6')).to.equal('Link')
  })

  it('base64 图片 JSON 推断为 Picture', () => {
    const json = JSON.stringify({ url: 'http://x/a.jpg', md5: 'abc', size: 1 })
    const b64 = typeof btoa !== 'undefined' ? btoa(json) : Buffer.from(json).toString('base64')
    const m = normalizeChatFields({ contentType: '', content: b64 })
    expect(m.ContentType).to.equal('Picture')
  })

  it('空文本消息保留（对齐 kelailaichatpc）', () => {
    expect(shouldSkipEmptyIncomingChat({ contentType: 'Text', content: '' })).to.equal(false)
    expect(shouldSkipEmptyIncomingChat({ contentType: 'Text', content: 'hi' })).to.equal(false)
    expect(shouldSkipEmptyIncomingChat({ contentType: 'System', content: '' })).to.equal(false)
  })

  it('空 Content 无 MsgSvrId 的媒体应跳过', () => {
    expect(shouldSkipEmptyIncomingChat({ contentType: 'Picture', content: '' })).to.equal(true)
    expect(shouldSkipEmptyIncomingChat({ contentType: 2, content: null })).to.equal(true)
  })

  it('空 Content 但有 MsgRemoteId 的媒体可解析', () => {
    const m = { contentType: 'Picture', content: '', msgRemoteId: '12345' }
    expect(isResolvableEmptyMedia(m)).to.equal(true)
    expect(shouldSkipEmptyIncomingChat(m)).to.equal(false)
  })

  it('失败名片且空内容应跳过', () => {
    expect(
      shouldSkipEmptyIncomingChat({ contentType: 'NameCard', content: '', status: '5' })
    ).to.equal(true)
    expect(
      shouldSkipEmptyIncomingChat({ contentType: 'NameCard', content: '{"name":"x"}', status: '5' })
    ).to.equal(false)
  })

  it('contentType:null 不挡 ContentType（pickChatField 路径）', () => {
    const m = normalizeChatFields({
      contentType: null,
      ContentType: '1',
      content: '你好'
    })
    expect(m.ContentType).to.equal('Text')
    expect(m.Content).to.equal('你好')
  })

  it('pickChatField 跳过 null/空', () => {
    expect(pickChatField({ contentType: null, ContentType: '1' }, 'contentType', 'ContentType')).to.equal('1')
    expect(pickChatField(null, 'a')).to.equal(undefined)
  })

  it('inferContentTypeFromBody 链接 JSON（无 url 字段）', () => {
    const body = JSON.stringify({ title: '标题', desc: '描述' })
    expect(inferContentTypeFromBody(body)).to.equal('Link')
  })

  it('inferContentTypeFromBody 纯 URL 推断 Picture', () => {
    expect(inferContentTypeFromBody('https://cdn.example.com/a.jpg')).to.equal('Picture')
  })

  it('WsContentSlimmed 空媒体可解析', () => {
    expect(isResolvableEmptyMedia({ WsContentSlimmed: true, contentType: 'Picture' })).to.equal(true)
    expect(isResolvableEmptyMedia({ msgRemoteId: '123', contentType: 'Picture', content: '' })).to.equal(true)
  })

  it('resolveChatContent 已是 JSON 不 decode', () => {
    expect(resolveChatContent({ content: '{"url":"x"}' })).to.equal('{"url":"x"}')
  })

  it('resolveChatContent base64 文本解码', () => {
    const plain = 'hello'
    expect(resolveChatContent({ content: base64.encode(plain) })).to.equal('hello')
  })

  it('normalizeChatFields debug 开启时走 anomaly 路径', () => {
    localStorage.setItem('workchat.msgFieldDebug', '1')
    const lines = []
    const warn = console.warn
    console.warn = (...args) => lines.push(args.join(' '))
    normalizeChatFields({ contentType: '', content: '' })
    console.warn = warn
    expect(lines.some((l) => l.includes('[msg-field-debug]'))).to.equal(true)
    localStorage.removeItem('workchat.msgFieldDebug')
  })

  it('inferContentTypeFromBody 视频号 JSON 不得误判为 Picture', () => {
    const body = JSON.stringify({
      nickname: '作者',
      des: '描述',
      cover: 'https://cdn/cover.jpg',
      url: 'https://finder.video.qq.com/feed',
      id: 'obj-1'
    })
    expect(inferContentTypeFromBody(body)).to.equal('ShiPinHao')
  })

  it('inferContentTypeFromBody 红包 JSON 含 Title 不得误判为 Link', () => {
    const body = JSON.stringify({ Key: 'hb-key-1', Title: '恭喜发财', TotalNum: 1 })
    expect(inferContentTypeFromBody(body)).to.equal('LuckyMoney')
  })

  it('inferContentTypeFromBody 转账 JSON 含 Feedesc 为 MoneyTrans', () => {
    const body = JSON.stringify({ Key: 't-key', Feedesc: '10.00', PaySubType: 1 })
    expect(inferContentTypeFromBody(body)).to.equal('MoneyTrans')
  })

  it('inferContentTypeFromBody has added HTML 归为 System', () => {
    const body = '<div class="el-message el-message--warning">has added Bob</div>'
    expect(inferContentTypeFromBody(body)).to.equal('System')
  })
})
