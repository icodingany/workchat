import { expect } from 'chai'
import { mergeDedupeAndSort } from '@/utils/chatMerge'
import { shouldSkipEmptyIncomingChat, normalizeChatFields } from '@/utils/chatMessageFields'
import {
  normalizeSendFailChat,
  enrichOutgoingNoticeFromLocalPreview
} from '@/utils/localSendPreview'

/**
 * 回归 2026-08-27：消息已发出但 PC 对话框消失。
 * TalkToFriendNotice 若先 RemoveLocalChat 再 AddChats，空 Content 无 MsgRemoteId 的 Notice
 * 会被 shouldSkipEmptyIncomingChat 丢弃，本地预览已被删 → 气泡消失。
 */
describe('TalkToFriendNotice 与本地预览', () => {
  const localPicture = {
    TaskId: '1756001000001',
    WxId: 'wx1',
    ConvId: 'c1',
    ContentType: 'Picture',
    Content: '{"Thumb":"http://127.0.0.1:18081/a.jpg","url":"http://127.0.0.1:18081/a.jpg"}',
    LocalSend: true,
    CreateTime: 1756001000,
    SenderId: 'wx1'
  }

  it('空 Notice 无 MsgRemoteId 应被跳过（不得先删本地预览）', () => {
    const notice = normalizeChatFields(
      normalizeSendFailChat({
        TaskId: '1756001000001',
        WxId: 'wx1',
        ConvId: 'c1',
        ContentType: 'Picture',
        Content: '',
        CreateTime: 1756001001,
        SenderId: 'wx1'
      })
    )
    expect(shouldSkipEmptyIncomingChat(notice)).to.equal(true)
  })

  it('合并路径：空 Notice 与本地预览合成一条并保留 Thumb', () => {
    const notice = {
      TaskId: '1756001000001',
      MsgRemoteId: '90001',
      WxId: 'wx1',
      ConvId: 'c1',
      ContentType: 'Picture',
      Content: '',
      CreateTime: 1756001001,
      SenderId: 'wx1'
    }
    const merged = mergeDedupeAndSort([localPicture], [notice])
    expect(merged).to.have.length(1)
    expect(String(merged[0].MsgRemoteId)).to.equal('90001')
    expect(merged[0].Content).to.include('Thumb')
    expect(merged[0].LocalSend).to.not.equal(true)
  })

  it('enrich 后空 Notice 可入库（不再被 skip）', () => {
    const notice = normalizeChatFields(
      normalizeSendFailChat({
        TaskId: '1756001000001',
        WxId: 'wx1',
        ConvId: 'c1',
        ContentType: 'Picture',
        Content: '',
        CreateTime: 1756001001,
        SenderId: 'wx1'
      })
    )
    const enriched = normalizeChatFields(
      enrichOutgoingNoticeFromLocalPreview([localPicture], notice)
    )
    expect(shouldSkipEmptyIncomingChat(enriched)).to.equal(false)
    expect(enriched.Content).to.include('Thumb')
  })

  it('模拟 Remove+Skip：删掉本地且 Notice 被跳过后列表为空', () => {
    const notice = {
      TaskId: '1756001000001',
      WxId: 'wx1',
      ConvId: 'c1',
      ContentType: 'Picture',
      Content: '',
      CreateTime: 1756001001
    }
    const normalized = normalizeChatFields(normalizeSendFailChat(notice))
    const wouldSkip = shouldSkipEmptyIncomingChat(normalized)
    expect(wouldSkip).to.equal(true)
    const afterRemove = []
    const afterAdd = wouldSkip ? afterRemove : mergeDedupeAndSort(afterRemove, [notice])
    expect(afterAdd).to.have.length(0)
    const correct = mergeDedupeAndSort([localPicture], [notice])
    expect(correct).to.have.length(1)
  })
})
