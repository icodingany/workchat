/**
 * 消息展示全链路回归：HTTP/WS → store 管线 → 视图字段。
 * 锁定症状「消息展示不出来」：任何一环断言失败 = 消息在链路中丢失/变空。
 */
import { expect } from 'chai'
import b64 from '@/utils/base64.js'
import { normalizeChatFields } from '@/utils/chatMessageFields'
import { mergeDedupeAndSort, insertChatSorted, mergeChatFields } from '@/utils/chatMerge'
import { mapHistoryRowToTalk } from '@/utils/mapHistoryRowToTalk'

/** 复刻 ShowChats chats() computed 的逐条变换（基线版本：normalizeChatFields 已含解码） */
function viewTransform(x) {
  const xi = { ...normalizeChatFields(x) }
  if (typeof xi.Content === 'string') {
    const t = xi.Content.trim()
    if (t.startsWith('{') && t.endsWith('}')) {
      try {
        xi.jContent = JSON.parse(t)
      } catch (e) {
        /* ignore */
      }
    }
  }
  return xi
}

const WX = 'wx_work_001'
const CONV = 'wxid_friend_777'

describe('消息展示全链路', () => {
  it('HTTP 历史行(snake_case) → 合并 → 视图：中文明文完整、类型正确、文本非空', () => {
    const rows = [
      { id: 1, convId: CONV, wxId: WX, contentType: 1, content: '在吗？看一下这个', msgTime: 1756000000, senderId: CONV, msgId: '1001', msgRemoteId: '2001' },
      { id: 2, convId: CONV, wxId: WX, contentType: 1, content: '好的谢谢', msgTime: 1756000010, senderId: WX, msgId: '1002', msgRemoteId: '2002' },
      { id: 3, convId: CONV, wxId: WX, contentType: 5, content: '对方已添加了你', msgTime: 1756000030, msgId: '1004', msgRemoteId: '2004' }
    ]
    const talks = rows.map((r) => mapHistoryRowToTalk(r, WX, CONV))
    const merged = mergeDedupeAndSort([], talks)
    expect(merged).to.have.lengthOf(3)

    const views = merged.map(viewTransform)
    const texts = views.filter((v) => v.ContentType === 'Text').map((v) => String(v.Content))
    expect(texts).to.include('在吗？看一下这个')
    expect(texts).to.include('好的谢谢')
    for (const v of views) {
      expect(v.ContentType, '每条消息都要解析出 ContentType').to.be.a('string').and.not.equal('')
      if (v.ContentType === 'Text') {
        expect(String(v.Content).trim(), '文本消息正文不得为空').to.not.equal('')
      }
    }
  })

  it('WS 实时推送(base64) → 入库过滤不丢 → 插入合并 → 视图解码出明文', () => {
    const notice = normalizeChatFields({
      WxId: WX,
      ConvId: CONV,
      ContentType: 'Text',
      Content: b64.encode('这是实时消息'),
      MsgRemoteId: '3001',
      CreateTime: '1756000100',
      SenderId: CONV
    })
    expect(notice.ContentType).to.equal('Text')
    const list = insertChatSorted(
      [{ WxId: WX, ConvId: CONV, ContentType: 'Text', Content: '在吗？看一下这个', MsgRemoteId: '2001', CreateTime: 1756000000, SenderId: CONV }],
      notice
    )
    expect(list).to.have.lengthOf(2)
    const wsView = viewTransform(list.find((m) => String(m.MsgRemoteId) === '3001'))
    expect(String(wsView.Content)).to.equal('这是实时消息')
  })

  it('WS base64 与 HTTP 明文同 MsgRemoteId 合并：正文不空、类型不丢', () => {
    const httpTalk = mapHistoryRowToTalk(
      { convId: CONV, wxId: WX, contentType: 1, content: '合并正文', msgTime: 1756000200, msgRemoteId: '4001' },
      WX,
      CONV
    )
    const wsDup = {
      WxId: WX,
      ConvId: CONV,
      ContentType: 'Text',
      Content: b64.encode('合并正文'),
      MsgRemoteId: '4001',
      CreateTime: 1756000200,
      SenderId: CONV
    }
    const merged = mergeChatFields(httpTalk, wsDup)
    const v = viewTransform(merged)
    expect(v.ContentType).to.equal('Text')
    expect(String(v.Content).trim(), '合并后正文不得为空').to.not.equal('')
  })

  it('WS 缺 ContentType（仅 base64 正文）也能推断类型并渲染', () => {
    const noType = normalizeChatFields({
      WxId: WX,
      ConvId: CONV,
      Content: b64.encode('没有类型的实时消息'),
      MsgRemoteId: '5001',
      CreateTime: '1756000300',
      SenderId: CONV
    })
    const v = viewTransform(noType)
    expect(v.ContentType).to.equal('Text')
    expect(String(v.Content)).to.equal('没有类型的实时消息')
  })

  it('contentType:null + ContentType:1 映射后视图可读（pickFirst 形状）', () => {
    const row = {
      convId: CONV,
      wxId: WX,
      contentType: null,
      ContentType: '1',
      content: '回归正文',
      msgTime: 1756000400,
      msgRemoteId: '6001'
    }
    const talk = mapHistoryRowToTalk(row, WX, CONV)
    const v = viewTransform(talk)
    expect(v.ContentType).to.equal('Text')
    expect(String(v.Content)).to.equal('回归正文')
    expect(String(v.Content)).to.not.include('undefined')
  })
})
