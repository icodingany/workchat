import { expect } from 'chai'
import {
  isAppinfoQuoteText,
  resolveWeworkQuoteFields,
  buildWeworkQuoteBubbleHtml,
  findQuotedMessageInChats,
  msgRemoteIdMatch
} from '@/utils/quoteMessage'

describe('quoteMessage', () => {
  it('detects appinfo wire text', () => {
    expect(isAppinfoQuoteText('wxid_synthetic_customer:13:0')).to.equal(true)
    expect(isAppinfoQuoteText('你好')).to.equal(false)
  })

  it('msgRemoteIdMatch compares as string', () => {
    expect(msgRemoteIdMatch('123', 123)).to.equal(true)
    expect(msgRemoteIdMatch('1', '2')).to.equal(false)
  })

  it('resolveWeworkQuoteFields replaces appinfo from currentChats', () => {
    const chats = [
      {
        MsgRemoteId: '9001',
        ContentType: 'Text',
        Content: '被引用的蛋糕价格'
      }
    ]
    const resolved = resolveWeworkQuoteFields(
      {
        text: '这个多少钱',
        quote: {
          senderName: '演示联系人',
          text: 'wxid_synthetic_customer:13:0',
          msgRid: '9001'
        }
      },
      chats
    )
    expect(resolved.quote.text).to.equal('被引用的蛋糕价格')
    expect(resolved.quote.msgRid).to.equal('9001')
  })

  it('findQuotedMessageInChats by MsgRemoteId', () => {
    const chats = [{ MsgRemoteId: '42', Content: 'x' }]
    expect(findQuotedMessageInChats(chats, '42')).to.deep.equal(chats[0])
  })

  it('buildWeworkQuoteBubbleHtml attaches click handler when msgRid present', () => {
    const html = buildWeworkQuoteBubbleHtml({
      replyHtml: '回复',
      quoteName: '张三',
      quoteHtml: '原消息',
      quoteMsgRid: '999'
    })
    expect(html).to.include('chat-quote-ref')
    expect(html).to.include('__handleQuoteMessageClick')
    expect(html).to.include("'999'")
    expect(html).to.include('张三')
  })
})
