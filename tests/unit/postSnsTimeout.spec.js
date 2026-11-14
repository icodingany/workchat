import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { sendSock } = vi.hoisted(() => ({ sendSock: vi.fn() }))

vi.mock('@/websocket/websocket', () => ({ sendSock }))

// store 为真实模块（postSnsTask 内 prepareOutboundMessage 只读 state）
vi.mock('@/store', () => ({
  default: { state: { webSocketToken: 'tok' }, getters: {}, dispatch: vi.fn(), commit: vi.fn() }
}))

const { Message } = vi.hoisted(() => ({ Message: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessage: Message }))

import store from '@/store'
import { postSnsTask, clearPostSnsTaskTimeout } from '@/api/webSocketApi'

/**
 * 回归 2026-08-28：定时/立即发圈后手机 hook 静默丢任务（无 PostSnsTaskResultNotice），
 * PC 只弹「朋友圈任务已经下发！」再无下文。对齐 TalkToFriendTask 20s 本地超时模式，
 * 发圈 60s 无回执时兜底 warning；回执到达（含定时任务二次生成的 TaskId，按 WxId 匹配）清除。
 */
describe('postSnsTask 本地超时兜底', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sendSock.mockClear()
    Message.mockClear()
    store.dispatch.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('下发后 60s 无回执 → 弹超时 warning', () => {
    postSnsTask({ WxId: 'wx-a', Content: 'hello' })
    expect(sendSock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(59_999)
    expect(Message).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(Message).toHaveBeenCalledTimes(1)
    expect(Message.mock.calls[0][0]).toMatchObject({ type: 'warning' })
    expect(Message.mock.calls[0][0].message).to.include('朋友圈')
  })

  it('收到 PostSnsTaskResultNotice（按 WxId 清除，定时任务 TaskId 会二次生成）→ 不弹超时', () => {
    postSnsTask({ WxId: 'wx-b', Content: 'hello' })
    // 定时发圈链路：调度器重新生成 TaskId，回执只带 WxId
    clearPostSnsTaskTimeout({ WxId: 'wx-b' })

    vi.advanceTimersByTime(120_000)
    expect(Message).not.toHaveBeenCalled()
  })

  it('同一 WxId 连发多次只保留一个计时器（不重复弹窗）', () => {
    postSnsTask({ WxId: 'wx-c', Content: 'a' })
    postSnsTask({ WxId: 'wx-c', Content: 'b' })

    vi.advanceTimersByTime(60_000)
    expect(Message).toHaveBeenCalledTimes(1)
  })

  it('回执清除只针对对应 WxId，其他 WxId 超时照常提示', () => {
    postSnsTask({ WxId: 'wx-d1', Content: 'a' })
    postSnsTask({ WxId: 'wx-d2', Content: 'b' })
    clearPostSnsTaskTimeout({ WxId: 'wx-d1' })

    vi.advanceTimersByTime(60_000)
    expect(Message).toHaveBeenCalledTimes(1)
    expect(Message.mock.calls[0][0].message).to.include('朋友圈')
  })
})
