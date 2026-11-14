/**
 * TakeLuckyMoney 的 TaskResultNotice 不得单独弹「开红包成功」
 * （Success=true 但 Amount=0 时会误导；以 TakeMoneyTaskResultNotice 为准）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: vi.fn()
}))

vi.mock('@/utils/pendingTakeMoneyTasks', () => ({
  clearPendingTakeMoneyTask: vi.fn()
}))

vi.mock('@/store', () => ({
  default: {
    commit: vi.fn(),
    dispatch: vi.fn(),
    state: {}
  }
}))

import { ElMessage } from 'element-plus'
import { clearPendingTakeMoneyTask } from '@/utils/pendingTakeMoneyTasks'
import taskResultNotice from '@/websocket/handler/taskResultNotice'

describe('taskResultNotice TakeLuckyMoney', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Success=true 也不弹开红包成功（避免金额为0假成功）', () => {
    taskResultNotice.taskResultMap({
      TaskType: 'TakeLuckyMoney',
      Success: true,
      TaskId: 12345
    })
    expect(clearPendingTakeMoneyTask).toHaveBeenCalledWith(12345)
    expect(ElMessage).not.toHaveBeenCalled()
  })

  it('Success=false 也不在此弹失败（由 TakeMoneyTaskResultNotice 统一提示）', () => {
    taskResultNotice.taskResultMap({
      TaskType: 'TakeLuckyMoneyTask',
      Success: false,
      TaskId: 99,
      ErrMsg: '红包未入账'
    })
    expect(clearPendingTakeMoneyTask).toHaveBeenCalledWith(99)
    expect(ElMessage).not.toHaveBeenCalled()
  })
})
