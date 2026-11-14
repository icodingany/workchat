/**
 * 重发幂等契约（2026-09-04 竞态协作协议·发送方向）。
 *
 * 服务端（wework-server）按 (wxId, taskId) 对 TalkToFriendTask 做发送幂等：
 * 在途重发不下发手机、已成功重发回放首次结果、已失败重发放行为真正重试。
 * 该协议成立的前提：红点重发必须复用失败气泡上的原 TaskId——
 * 若重发生成新 TaskId，服务端无从识别，客户会收到重复消息（回归事故形态）。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { expect } from 'chai'

const methodsUiSrc = readFileSync(
  resolve(__dirname, '../../src/views/conversation/components/secondPart/showChatsMixin/methodsUi.js'),
  'utf8'
)

describe('resendFailedOutgoingChat 重发复用原 TaskId', () => {
  it('红点重发把 chat.TaskId 作为第 7 参传给 TalkToFriendTask（服务端发送幂等的前提）', () => {
    expect(methodsUiSrc).to.include('TalkToFriendTask(wxId, convId, ct, content, refId, at, chat.TaskId)')
  })

  it('重发调用不带说明注释会丢协议语义（注释必须解释为何复用 TaskId）', () => {
    const idx = methodsUiSrc.indexOf('resendFailedOutgoingChat')
    const body = methodsUiSrc.slice(idx)
    expect(body).to.include('重发复用原 TaskId')
  })
})
