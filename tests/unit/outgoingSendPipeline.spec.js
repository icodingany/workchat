/**
 * 出站消息全链路回归（纯函数 + store 语义模拟，不拉浏览器）
 *
 * 覆盖出站消息回归场景：
 *   1. 连发图片的失败状态（此处只测试客户端消息合并链）
 *   2. 发出后 PC 气泡消失（RemoveLocalChat + 空 Notice skip）
 */
import { expect } from 'chai'
import { mergeDedupeAndSort } from '@/utils/chatMerge'
import { normalizeChatFields, shouldSkipEmptyIncomingChat } from '@/utils/chatMessageFields'
import {
  applyTalkResultToLocalMessages,
  enrichOutgoingNoticeFromLocalPreview,
  markLocalSendFailedInMessages,
  normalizeSendFailChat,
  isSendFailedChat,
  isLocalSendingChat
} from '@/utils/localSendPreview'
import { prepareChatsForView } from '@/utils/prepareChatForView'

const WX = 'wx_pipeline'
const CONV = 'conv_pipeline'
const TASK = '1756002000001'
const THUMB_JSON =
  '{"Thumb":"http://127.0.0.1:18081/a.jpg","url":"http://127.0.0.1:18081/a.jpg"}'

function localPicturePreview() {
  return normalizeChatFields({
    TaskId: TASK,
    WxId: WX,
    ConvId: CONV,
    ContentType: 'Picture',
    Content: THUMB_JSON,
    LocalSend: true,
    CreateTime: 1756002000,
    SenderId: WX,
    IsSend: true
  })
}

function emptyPictureNotice(over = {}) {
  return normalizeChatFields(
    normalizeSendFailChat({
      TaskId: TASK,
      WxId: WX,
      ConvId: CONV,
      ContentType: 'Picture',
      Content: '',
      CreateTime: 1756002001,
      SenderId: WX,
      IsSend: true,
      ...over
    })
  )
}

/** 模拟 AddChats 当前会话 enrich + skip 闸门 */
function simulateAddChats(messages, rawNotice) {
  let notice = normalizeChatFields(normalizeSendFailChat(rawNotice))
  if (messages && messages.length) {
    notice = normalizeChatFields(enrichOutgoingNoticeFromLocalPreview(messages, notice))
  }
  if (shouldSkipEmptyIncomingChat(notice)) {
    return { skipped: true, notice, messages }
  }
  const merged = mergeDedupeAndSort(messages || [], [notice])
  return { skipped: false, notice, messages: merged }
}

describe('outgoing send pipeline（出站全链路）', () => {
  it('Happy：Result 补 MsgRemoteId → 空 Notice enrich 合并 → 仍一条且可渲染', () => {
    let list = [localPicturePreview()]
    list = applyTalkResultToLocalMessages(list, {
      Success: true,
      TaskId: TASK,
      MsgId: '9001',
      MsgRemoteId: '1009001'
    })
    expect(isLocalSendingChat(list[0])).to.equal(false)

    const { skipped, messages } = simulateAddChats(list, {
      TaskId: TASK,
      MsgRemoteId: '1009001',
      ContentType: 'Picture',
      Content: ''
    })
    expect(skipped).to.equal(false)
    expect(messages).to.have.length(1)
    expect(String(messages[0].MsgRemoteId)).to.equal('1009001')
    expect(messages[0].Content).to.include('Thumb')

    const view = prepareChatsForView(messages)
    expect(view).to.have.length(1)
    expect(view[0].Content).to.include('Thumb')
  })

  it('Regression：旧路径 Remove 后空 Notice 被 skip → 列表清空', () => {
    const list = [localPicturePreview()]
    const notice = emptyPictureNotice()
    expect(shouldSkipEmptyIncomingChat(notice)).to.equal(true)
    const afterRemove = []
    const afterAdd = simulateAddChats(afterRemove, notice)
    expect(afterAdd.messages).to.have.length(0)
    expect(afterAdd.skipped).to.equal(true)
  })

  it('Fix：不 Remove，enrich 后空 Notice 可入库', () => {
    const list = [localPicturePreview()]
    const { skipped, messages } = simulateAddChats(list, {
      TaskId: TASK,
      ContentType: 'Picture',
      Content: ''
    })
    expect(skipped).to.equal(false)
    expect(messages).to.have.length(1)
    expect(messages[0].Content).to.include('Thumb')
  })

  it('失败回执 → Status=5 保留气泡', () => {
    let list = [localPicturePreview()]
    list = markLocalSendFailedInMessages(list, {
      TaskId: TASK,
      Success: false,
      ErrMsg: 'download failed'
    })
    expect(isSendFailedChat(list[0])).to.equal(true)
    expect(list[0].Content).to.include('Thumb')
  })

  it('连发两条：TaskId 不同不互删', () => {
    const a = localPicturePreview()
    const b = {
      ...localPicturePreview(),
      TaskId: '1756002000002',
      Content: '{"Thumb":"http://127.0.0.1:18081/b.jpg","url":"http://127.0.0.1:18081/b.jpg"}',
      CreateTime: 1756002010
    }
    const merged = mergeDedupeAndSort([a], [
      normalizeChatFields({
        TaskId: '1756002000002',
        MsgRemoteId: '1009002',
        WxId: WX,
        ConvId: CONV,
        ContentType: 'Picture',
        Content: '',
        CreateTime: 1756002011
      }),
      b
    ])
    expect(merged.length).to.be.at.least(2)
  })
})
