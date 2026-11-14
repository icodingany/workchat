import { expect } from 'chai'
import {
  prepareChatsForView,
  prepareChatViewItem,
  attachJContent,
  filterDuplicateFriendAddGreetings,
  buildChatViewFinger
} from '@/utils/prepareChatForView'

describe('prepareChatForView', () => {
  it('normalize + 解析 JSON Content 为 jContent', () => {
    const item = prepareChatViewItem({
      contentType: 2,
      content: '{"url":"https://cdn/a.jpg","thumbUrl":"https://cdn/t.jpg"}',
      msgRemoteId: 'p1'
    })
    expect(item.ContentType).to.equal('Picture')
    expect(item.jContent.url).to.equal('https://cdn/a.jpg')
  })

  it('filterFriendAddGreetings 隐藏全部 has added', () => {
    const msgs = [
      { ContentType: 'System', Content: '<i></i> has added A', CreateTime: 1 },
      { ContentType: 'System', Content: '<i></i> has added B', CreateTime: 2 },
      { ContentType: 'Text', Content: 'hi', CreateTime: 3 }
    ]
    const out = filterDuplicateFriendAddGreetings(msgs)
    expect(out).to.have.length(1)
    expect(out[0].Content).to.equal('hi')
  })

  it('误判为 Text 的 has added HTML 亦隐藏', () => {
    const msgs = [
      {
        ContentType: 'Text',
        Content: '<div class="el-message el-message--warning">has added Bob</div>',
        CreateTime: 1
      },
      { ContentType: 'Text', Content: '你好', CreateTime: 2 }
    ]
    const out = filterDuplicateFriendAddGreetings(msgs)
    expect(out).to.have.length(1)
    expect(out[0].Content).to.equal('你好')
  })

  it('prepareChatsForView 全链路', () => {
    const out = prepareChatsForView([
      { contentType: 1, content: '你好', msgRemoteId: '1' },
      { contentType: 1, content: 'world', msgRemoteId: '2' }
    ])
    expect(out).to.have.length(2)
    expect(out[0].Content).to.equal('你好')
    expect(out[0].ContentType).to.equal('Text')
  })

  it('buildChatViewFinger 含关键字段', () => {
    const f = buildChatViewFinger({
      MsgRemoteId: 'r1',
      MsgId: 'm1',
      ContentType: 'Text',
      Content: 'abc',
      CreateTime: 100
    })
    expect(f).to.include('r1')
    expect(f).to.include('Text')
    expect(f).to.include('3')
  })

  it('attachJContent 非 JSON 不报错', () => {
    const xi = attachJContent({ Content: 'plain text', ContentType: 'Text' })
    expect(xi.jContent).to.be.undefined
  })
})
