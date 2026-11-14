/**
 * AcceptCustomerTask：手机 hook 对「已是好友」返回 failed("has added")。
 * 不得原样弹 ElMessage（批量通过时会叠满屏挡住聊天）；应视为已成功并从待验证列表移除。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: vi.fn()
}))

vi.mock('@/utils/pendingTakeMoneyTasks', () => ({
  clearPendingTakeMoneyTask: vi.fn()
}))

vi.mock('@/utils/outgoingAck', () => ({
  handleTalkToFriendTaskResult: vi.fn()
}))

vi.mock('@/api/webSocketApi', () => ({
  triggerWechatFriendPushTask: vi.fn(),
  TriggerUserLabelTask: vi.fn(),
  GetContactInfoTask: vi.fn(),
  clearTalkToFriendTaskTimeout: vi.fn()
}))

vi.mock('@/store', () => ({
  default: {
    commit: vi.fn(),
    dispatch: vi.fn(),
    state: { conversation: { pendingConvFlags: {} } }
  }
}))

import { ElMessage } from 'element-plus'
import store from '@/store'
import taskResultNotice from '@/websocket/handler/taskResultNotice'

describe('taskResultNotice AcceptCustomerTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ErrMsg=has added 不弹 toast，并按成功更新待验证列表', () => {
    taskResultNotice.taskResultMap({
      TaskType: 'AcceptCustomerTask',
      Success: false,
      ErrMsg: 'has added',
      WxId: 'wx1',
      TaskId: 168001
    })
    expect(ElMessage).not.toHaveBeenCalled()
    expect(store.commit).toHaveBeenCalledWith(
      'tools/UPDATE_NEW_FRIENDS',
      expect.objectContaining({
        Success: true,
        WxId: 'wx1',
        TaskId: 168001
      })
    )
  })

  it('其它失败仍弹 toast（中文可读）', () => {
    taskResultNotice.taskResultMap({
      TaskType: 'AcceptCustomerTask',
      Success: false,
      ErrMsg: 'no this customer',
      WxId: 'wx1',
      TaskId: 2
    })
    expect(ElMessage).toHaveBeenCalled()
    const arg = ElMessage.mock.calls[0][0]
    expect(arg.type).toBe('warning')
    expect(String(arg.message)).toMatch(/客户|好友|失败/)
  })

  it('Success=true 不弹 toast', () => {
    taskResultNotice.taskResultMap({
      TaskType: 'AcceptCustomerTask',
      Success: true,
      WxId: 'wx1',
      TaskId: 3
    })
    expect(ElMessage).not.toHaveBeenCalled()
    expect(store.commit).toHaveBeenCalledWith(
      'tools/UPDATE_NEW_FRIENDS',
      expect.objectContaining({ Success: true })
    )
  })
})
