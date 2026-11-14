import { expect } from 'chai'
import {
  applyTalkResultToLocalMessages,
  findLocalPreviewIndex,
  isLocalSendingChat,
  isOutgoingMediaContentType,
  isSendFailedChat,
  markLocalSendFailedInMessages,
  markLocalPendingSyncInMessages,
  isExplicitTalkToFriendTaskResultFailure,
  isTalkToFriendTaskResultSuccess,
  normalizeSendFailChat,
  shouldShowSendFailResend
} from '@/utils/localSendPreview'

/**
 * 回归：消息已发送成功但气泡旁一直转圈。
 * c98ba01 把 RemoveLocalChat 从 Result 挪到 Notice 后，若 Notice 未到或 TaskId=0，
 * 本地预览没有 MsgId，ShowChats 会一直显示 el-icon-loading。
 * 修复：Result Success 时补 MsgId/MsgRemoteId 停转圈，不删内容。
 */
describe('local send preview (spinner after send success)', () => {
  const taskId = 80000000000030003
  const localPreview = {
    TaskId: taskId,
    ContentType: 'Text',
    Content: '测试',
    SenderId: '1',
    ConvId: '2',
    LocalSend: true
  }

  it('LocalSend 为 true 时应视为发送中', () => {
    expect(isLocalSendingChat(localPreview)).to.equal(true)
  })

  it('私聊发图 LocalSend 期间也应转圈（与文本一致，2026-08-26）', () => {
    expect(
      isLocalSendingChat({
        ...localPreview,
        ContentType: 'Picture',
        Content: '{"url":"http://127.0.0.1:18081/x.jpg"}'
      })
    ).to.equal(true)
  })

  it('Result Success 后补 MsgId，转圈应停止且不删气泡', () => {
    const messages = [localPreview]
    const next = applyTalkResultToLocalMessages(messages, {
      Success: true,
      TaskId: String(taskId),
      MsgId: 99,
      MsgRemoteId: 88,
      CreateTime: 1753419491
    })
    expect(next).to.have.length(1)
    expect(next[0].Content).to.equal('测试')
    expect(next[0].MsgId).to.equal(99)
    expect(next[0].MsgRemoteId).to.equal(88)
    expect(isLocalSendingChat(next[0])).to.equal(false)
  })

  it('TaskId number/string 混用仍能匹配本地预览', () => {
    expect(findLocalPreviewIndex([localPreview], { TaskId: String(taskId) })).to.equal(0)
    expect(findLocalPreviewIndex([localPreview], { TaskId: taskId })).to.equal(0)
  })

  it('TaskId 经 JSON number 舍入后仍能匹配本地预览（int64 精度丢失）', () => {
    const exact = '800000000000050005'
    const preview = { ...localPreview, TaskId: exact }
    const rounded = Number(exact)
    expect(findLocalPreviewIndex([preview], { TaskId: rounded })).to.equal(0)
  })

  it('Notice TaskId=0 时可用已补过的 MsgId 找到本地预览', () => {
    const patched = applyTalkResultToLocalMessages([localPreview], {
      Success: true,
      TaskId: taskId,
      MsgId: 99,
      MsgRemoteId: 88
    })
    expect(findLocalPreviewIndex(patched, { TaskId: 0, MsgId: 99 })).to.equal(0)
  })

  it('Result 失败不改本地预览', () => {
    const messages = [{ ...localPreview, LocalSend: true }]
    const next = applyTalkResultToLocalMessages(messages, {
      Success: false,
      TaskId: taskId,
      MsgId: 99
    })
    expect(next).to.equal(messages)
    expect(isLocalSendingChat(next[0])).to.equal(true)
  })

  it('Success 缺省但有 MsgRemoteId 视为成功并清掉误标 Status=5', () => {
    const failed = { ...localPreview, Status: 5, SendFailReason: '发送失败' }
    const next = applyTalkResultToLocalMessages([failed], {
      TaskId: taskId,
      MsgRemoteId: 88
    })
    expect(next[0].MsgRemoteId).to.equal(88)
    expect(next[0].Status).to.be.undefined
    expect(next[0].SendFailReason).to.be.undefined
    expect(isLocalSendingChat(next[0])).to.equal(false)
  })
})

describe('TalkToFriendTaskResult success detection', () => {
  it('Success 缺省无 MsgId 不算明确失败', () => {
    expect(isTalkToFriendTaskResultSuccess({ TaskId: 1 })).to.equal(false)
    expect(isExplicitTalkToFriendTaskResultFailure({ TaskId: 1 })).to.equal(false)
  })

  it('Success=false 为明确失败', () => {
    expect(isTalkToFriendTaskResultSuccess({ Success: false })).to.equal(false)
    expect(isExplicitTalkToFriendTaskResultFailure({ Success: false })).to.equal(true)
  })

  it('有 MsgRemoteId 无 Success 字段视为成功', () => {
    expect(isTalkToFriendTaskResultSuccess({ MsgRemoteId: 99 })).to.equal(true)
  })
})

describe('local send preview (send failed Status=5)', () => {
  const taskId = 80000000000040004
  const localPreview = {
    TaskId: taskId,
    ContentType: 'Text',
    Content: '测试',
    SenderId: '1',
    ConvId: '2',
    LocalSend: true
  }

  it('Status=5 时不应再转圈', () => {
    expect(isLocalSendingChat({ ...localPreview, Status: 5 })).to.equal(false)
  })

  it('markLocalSendFailedInMessages 按 TaskId 写入 Status=5 与 SendFailReason', () => {
    const next = markLocalSendFailedInMessages([localPreview], {
      TaskId: String(taskId),
      ErrMsg: '对方还不是好友'
    })
    expect(next).to.have.length(1)
    expect(next[0].Status).to.equal(5)
    expect(next[0].SendFailReason).to.equal('对方还不是好友')
    expect(next[0].LocalSend).to.equal(false)
    expect(isLocalSendingChat(next[0])).to.equal(false)
  })

  it('列表中无发送中预览时返回原数组', () => {
    const settled = [{ TaskId: 1, MsgId: 9, MsgRemoteId: 8, Content: '已发出' }]
    const next = markLocalSendFailedInMessages(settled, { TaskId: '999', ErrMsg: 'x' })
    expect(next).to.equal(settled)
  })

  it('无 ErrMsg 时默认「发送失败」', () => {
    const next = markLocalSendFailedInMessages([localPreview], { TaskId: taskId })
    expect(next[0].SendFailReason).to.equal('发送失败')
  })

  it('TaskId=0 对不上时应回退标记最后一条发送中预览', () => {
    const next = markLocalSendFailedInMessages([localPreview], {
      TaskId: 0,
      Success: false,
      ErrMsg: '发送失败'
    })
    expect(next[0].Status).to.equal(5)
    expect(next[0].SendFailReason).to.equal('发送失败')
    expect(isLocalSendingChat(next[0])).to.equal(false)
  })

  it('PendingSync 状态不显示转圈', () => {
    expect(isLocalSendingChat({ ...localPreview, PendingSync: true })).to.equal(false)
  })

  it('PendingSync 后手机真实失败回执（带 TaskId）仍必须标红点（2026-08-26 生产：媒体 3-4 分钟回失败被吞）', () => {
    const pending = { ...localPreview, LocalSend: false, PendingSync: true, ContentType: 'Picture' }
    const next = markLocalSendFailedInMessages([pending], {
      TaskId: String(taskId),
      Success: false,
      ErrMsg: 'timeout'
    })
    expect(next[0].Status, '真实回执必须标失败').to.equal(5)
    expect(next[0].SendFailReason).to.equal('timeout')
    expect(next[0].PendingSync).to.equal(false)
  })

  it('PC LocalTimeout 对全部类型标红点（2026-08-27 合成回归场景：风暴中手机静默丢任务，永无回执）', () => {
    // 文本 LocalSend 态
    const sending = { ...localPreview, LocalSend: true, ContentType: 'Text' }
    expect(
      markLocalSendFailedInMessages([sending], {
        TaskId: String(taskId),
        LocalTimeout: true,
        ErrMsg: '发送超时'
      })[0].Status
    ).to.equal(5)
    // 图片 PendingSync 态
    const pendingPic = { ...localPreview, LocalSend: false, PendingSync: true, ContentType: 'Picture' }
    expect(
      markLocalSendFailedInMessages([pendingPic], {
        TaskId: String(taskId),
        LocalTimeout: true,
        ErrMsg: '发送超时'
      })[0].Status
    ).to.equal(5)
  })

  it('PendingSync 后文本 20s 本地超时也标红点（2026-08-27 合成回归场景：重连风暴中手机静默丢文本任务，永无回执）', () => {
    const pending = { ...localPreview, LocalSend: false, PendingSync: true, ContentType: 'Text' }
    const next = markLocalSendFailedInMessages([pending], {
      TaskId: String(taskId),
      Success: false,
      LocalTimeout: true,
      ErrMsg: '发送超时'
    })
    expect(next[0].Status, '文本静默丢失必须给红点让客服可重发').to.equal(5)
    expect(next[0].SendFailReason).to.equal('发送超时')
  })

  it('markLocalPendingSyncInMessages 释放转圈进入 PendingSync', () => {
    const next = markLocalPendingSyncInMessages([{ ...localPreview, LocalSend: true }], {
      TaskId: taskId
    })
    expect(next[0].PendingSync).to.equal(true)
    expect(next[0].LocalSend).to.equal(false)
    expect(isLocalSendingChat(next[0])).to.equal(false)
  })

  it('8s fallback 进入 PendingSync 后，文本 20s 本地超时同样标红点（合成回归场景静默丢弃）', () => {
    const pending = markLocalPendingSyncInMessages(
      [{ ...localPreview, LocalSend: true, ContentType: 'Text' }],
      { TaskId: taskId }
    )
    const next = markLocalSendFailedInMessages(pending, {
      TaskId: taskId,
      LocalTimeout: true,
      ErrMsg: '发送超时'
    })
    expect(next[0].Status).to.equal(5)
    expect(next[0].SendFailReason).to.equal('发送超时')
  })

  it('8s fallback 已补 MsgId 后，20s 超时不应再标 Status=5', () => {
    const patched = applyTalkResultToLocalMessages([localPreview], {
      Success: true,
      TaskId: taskId,
      MsgId: taskId,
      MsgRemoteId: taskId
    })
    const next = markLocalSendFailedInMessages(patched, {
      TaskId: taskId,
      ErrMsg: '发送超时'
    })
    expect(next).to.equal(patched)
    expect(next[0].Status).to.be.undefined
  })
})

describe('normalizeSendFailChat', () => {
  it('Flag 失败位归一 Status=5', () => {
    const out = normalizeSendFailChat({ flag: 0x10000 })
    expect(out.Status).to.equal(5)
    expect(out.Flag).to.equal(0x10000)
  })

  it('无失败位仅补 Flag 字段', () => {
    const out = normalizeSendFailChat({ flag: 32 })
    expect(out.Flag).to.equal(32)
    expect(out.Status).to.equal(undefined)
  })
})

describe('isSendFailedChat (企微同步失败态)', () => {
  it('本地 Status=5 视为失败', () => {
    expect(isSendFailedChat({ Status: 5 })).to.equal(true)
  })

  it('EnumSendStatus.SendError=0x10 视为失败', () => {
    expect(isSendFailedChat({ Status: 0x10 })).to.equal(true)
    expect(isSendFailedChat({ Status: 16 })).to.equal(true)
  })

  it('Flag 带 SCRM 发送失败位 0x10000 视为失败', () => {
    expect(isSendFailedChat({ Flag: 0x10000 })).to.equal(true)
    expect(isSendFailedChat({ Flag: 32 | 0x10000 })).to.equal(true)
    expect(isSendFailedChat({ flag: 0x10000 })).to.equal(true)
  })

  it('普通成功消息不视为失败', () => {
    expect(isSendFailedChat({ Status: 0x11, Flag: 0 })).to.equal(false)
    expect(isSendFailedChat({ Flag: 32 })).to.equal(false)
    expect(isSendFailedChat(null)).to.equal(false)
  })
})

describe('findLocalPreviewIndex / markLocalSendFailed', () => {
  it('TaskId=0 时按 MsgId 回退匹配', () => {
    const messages = [{ TaskId: '0', MsgId: '77', LocalSend: true, Content: 'x' }]
    expect(findLocalPreviewIndex(messages, { TaskId: '0', MsgId: '77' })).to.equal(0)
  })

  it('markLocalSendFailed 失败回包 TaskId=0 回退最后一条发送中', () => {
    const messages = [
      { TaskId: '1', LocalSend: false, Content: 'done' },
      { TaskId: '2', LocalSend: true, Content: 'pending' }
    ]
    const next = markLocalSendFailedInMessages(messages, { TaskId: '0', ErrMsg: '超时' })
    expect(next[1].Status).to.equal(5)
    expect(next[1].SendFailReason).to.equal('超时')
  })

  it('shouldShowSendFailResend 委托 isSendFailedChat', () => {
    expect(shouldShowSendFailResend({ Status: 5 })).to.equal(true)
    expect(shouldShowSendFailResend({ Status: 0 })).to.equal(false)
  })
})

describe('isOutgoingMediaContentType', () => {
  it('识别 Picture/Video 等媒体类型', () => {
    expect(isOutgoingMediaContentType('Picture')).to.equal(true)
    expect(isOutgoingMediaContentType(2)).to.equal(true)
    expect(isOutgoingMediaContentType('Text')).to.equal(false)
  })
})
