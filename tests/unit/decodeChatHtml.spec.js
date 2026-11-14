import { expect } from 'chai'
import { decodeChatHtml } from '@/utils/decodeChatHtml'
import { prepareChatViewItem } from '@/utils/prepareChatForView'

describe('decodeChatHtml', () => {
  it('Text 消息渲染 qq 表情路径', () => {
    const chat = prepareChatViewItem({ contentType: 1, content: '你好', msgRemoteId: '1' })
    const html = decodeChatHtml(chat, { useCache: false })
    expect(html).to.include('你好')
  })

  it('Picture 有 jContent.url 输出 img', () => {
    const chat = prepareChatViewItem({
      contentType: 2,
      content: '{"url":"https://cdn.example.com/a.jpg","thumbUrl":"https://cdn.example.com/t.jpg"}',
      msgRemoteId: '2'
    })
    const html = decodeChatHtml(chat, { useCache: false, pictureOnerror: true })
    expect(html).to.include('<img')
    expect(html).to.include('https://cdn.example.com/a.jpg')
    expect(html).to.include('referrerpolicy="no-referrer"')
  })

  it('Link JSON 渲染 title/desc', () => {
    const chat = prepareChatViewItem({
      contentType: 6,
      content: '{"title":"标题","desc":"描述","thumbUrl":"https://cdn/x.jpg"}',
      msgRemoteId: '3'
    })
    const html = decodeChatHtml(chat, { useCache: false })
    expect(html).to.include('标题')
    expect(html).to.include('描述')
    expect(html).to.include('link-type')
  })

  it('File 分支走统一 html 路径（非 early return）', () => {
    const chat = prepareChatViewItem({
      contentType: 8,
      content: '{"Title":"报告.pdf","Des":"100KB,pdf","Source":"手机"}',
      msgRemoteId: '4'
    })
    const html = decodeChatHtml(chat, { useCache: false })
    expect(html).to.include('报告.pdf')
    expect(html).to.include('file-title')
  })

  it('useCache 写入 __decodedHtml', () => {
    const chat = prepareChatViewItem({ contentType: 1, content: 'cached', msgRemoteId: '5' })
    expect(chat.__decodedHtml).to.be.undefined
    const html1 = decodeChatHtml(chat)
    expect(chat.__decodedHtml).to.equal(html1)
    const html2 = decodeChatHtml(chat)
    expect(html2).to.equal(html1)
  })

  it('MoneyTrans 用 ctx.isSelfMsg / friendNick', () => {
    const chat = prepareChatViewItem({
      contentType: 12,
      content: '{"Feedesc":"1.00","PaySubType":1}',
      msgRemoteId: '6',
      SenderId: 'wx_self'
    })
    const html = decodeChatHtml(chat, {
      useCache: false,
      isSelfMsg: () => true,
      friendNick: '张三'
    })
    expect(html).to.include('转账给张三')
  })

  it('空 chat 返回空串', () => {
    expect(decodeChatHtml(null)).to.equal('')
  })

  it('LuckyMoney 未领取展示祝福语 + 分隔线 + 微信红包', () => {
    const chat = prepareChatViewItem({
      contentType: 11,
      content: '{"Key":"hb1","Title":"恭喜发财"}',
      msgRemoteId: '888'
    })
    const html = decodeChatHtml(chat, { useCache: false, luckMoneyMap: {} })
    expect(html).to.include('luck-wish')
    expect(html).to.include('luck-divider')
    expect(html).to.include('微信红包')
    expect(html).to.include('jubo-lucky-money')
  })

  it('LuckyMoney 已领取显示金额与已被领取', () => {
    const chat = prepareChatViewItem({
      contentType: 11,
      content: '{"Key":"hb1","Title":"恭喜发财"}',
      msgRemoteId: '888'
    })
    const html = decodeChatHtml(chat, {
      useCache: false,
      luckMoneyMap: { '888': { opened: true, Amount: 1000 } }
    })
    expect(html).to.include('luck-opened')
    expect(html).to.include('¥10.00')
    expect(html).to.include('已被领取')
  })

  it('MoneyTrans 已退还显示「已退还」', () => {
    const chat = prepareChatViewItem({
      contentType: 12,
      content: '{"Key":"tf1","Feedesc":"1.00","PaySubType":1}',
      msgRemoteId: '777',
      WxId: 'wx1'
    })
    const html = decodeChatHtml(chat, {
      useCache: false,
      luckMoneyMap: {},
      refundedTransferKeys: { 'wx1:tf1': true },
      currentWxId: 'wx1'
    })
    expect(html).to.include('已退还')
  })

  it('MoneyTrans PaySubType 4 显示已退还', () => {
    const chat = prepareChatViewItem({
      contentType: 12,
      content: '{"Key":"tf2","Feedesc":"2.00","PaySubType":4}',
      msgRemoteId: '776'
    })
    const html = decodeChatHtml(chat, { useCache: false })
    expect(html).to.include('已退还')
  })

  it('QuoteMsg 解析 appinfo 泄漏并从 currentChats 回查被引用正文', () => {
    const chat = prepareChatViewItem({
      contentType: 22,
      content: JSON.stringify({
        text: '这个多少钱',
        quote: {
          senderName: '演示联系人',
          text: 'wxid_synthetic_customer:13:0',
          msgRid: '9001'
        }
      }),
      msgRemoteId: '8001'
    })
    const html = decodeChatHtml(chat, {
      useCache: false,
      currentChats: [
        { MsgRemoteId: '9001', ContentType: 'Text', Content: '蛋糕多少钱' }
      ]
    })
    expect(html).to.include('这个多少钱')
    expect(html).to.include('蛋糕多少钱')
    expect(html).to.include('演示联系人')
    expect(html).not.to.include('wxid_synthetic_customer')
    expect(html).to.include('__handleQuoteMessageClick')
  })
})
