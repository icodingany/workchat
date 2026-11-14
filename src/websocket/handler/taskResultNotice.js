import store from '@/store'
import { triggerWechatFriendPushTask, TriggerUserLabelTask, GetContactInfoTask, clearTalkToFriendTaskTimeout } from '@/api/webSocketApi'
import { ElMessage as Message } from 'element-plus'
import { handleTalkToFriendTaskResult } from '@/utils/outgoingAck'
import { clearPendingTakeMoneyTask } from '@/utils/pendingTakeMoneyTasks'

/** 手机 hook AcceptCustomerTask 英文失败码 → PC 侧处理 */
function normalizeAcceptCustomerResult(message) {
  if (!message) return message
  const err = String(message.ErrMsg || '').trim()
  // 已是好友：hook 仍 failed("has added")，批量自动通过时会叠满 ElMessage 挡住聊天
  if (/^has added$/i.test(err)) {
    return { ...message, Success: true, ErrMsg: '' }
  }
  const zh =
    err === 'no this customer'
      ? '未找到该客户'
      : err.startsWith('Error:')
        ? '通过好友验证失败'
        : err
  return zh && zh !== err ? { ...message, ErrMsg: zh } : message
}

function applyPendingConvFlagResult(message) {
  const taskId = message.TaskId != null ? String(message.TaskId) : ''
  const pending = taskId ? store.state.conversation.pendingConvFlags[taskId] : null
  if (pending) {
    store.commit('conversation/CLEAR_PENDING_CONV_FLAG', taskId)
  }
  if (message.Success) return
  if (pending) {
    const rollback = {
      WxId: pending.WxId,
      RemoteId: pending.RemoteId
    }
    if (pending.isTop !== undefined) {
      rollback.isTop = pending.prevIsTop
    }
    if (pending.Notified !== undefined) {
      rollback.Notified = pending.prevNotified
    }
    store.dispatch('conversation/PatchConversationFlags', rollback)
  }
  Message({
    type: 'warning',
    message: message.ErrMsg || '置顶/免打扰设置失败',
    duration: 2500
  })
}

function taskResultMap(message) {
  switch (message.TaskType) {
    // 通过搜索号码添加客户返回 ok
    case 'AddCustomerFromSearchTask':
      store.dispatch('tools/UpdateAddCustomerFromSearchTask', {
        ...message,
        result: message.Success ? '已执行' : message.ErrMsg,
        TaskId: Number(message.TaskId)
      })
      if (!message.Success && message.ErrMsg) {
        Message({
          type: 'warning',
          message: message.ErrMsg,
          duration: 3000
        })
      }
      break
    // 通过微信好友添加客户返回 ok
    case 'AddCustomerFromWxTask':
      if (message.Success) {
        // 获取最新的好友列表
        triggerWechatFriendPushTask(message.WxId)
        // 如果好友很多建议改为修改本地数据
      }
      break
    // 群管理 / 置顶 / 免打扰：失败回滚乐观更新
    case 'ChatRoomActionTask':
      applyPendingConvFlagResult(message)
      break
    // 客户打（移除）标签的操作 ok
    case 'UserLabelSetTask':
      if (message.Success) {
        GetContactInfoTask(message.WxId, message.TaskId)
      } else {
        Message({
          type: 'warning',
          message: message.ErrMsg || '打标签失败',
          duration: 2000
        })
      }
      break
    // 修改客户备注
    case 'SetUserMemoTask':
      if (message.Success) {
        GetContactInfoTask(message.WxId, message.TaskId)
        Message({ type: 'success', message: '备注已更新', duration: 1500 })
      } else {
        Message({ type: 'warning', message: message.ErrMsg || '设置备注失败', duration: 2000 })
      }
      break
    // 删除个人标签
    case 'UserLabelDelTask':
      TriggerUserLabelTask(message.WxId)
      break
    // 删除朋友圈结果 ok
    case 'DelSnsTask':
      if (message.Success) {
        store.commit('circle/UPDATE_CIRCLES_BY_DELETE', message)
      }
      break
    // 朋友圈点赞结果通知 ok
    case 'SnsLikeTask':
      break
    // 发消息（部分通道只回 TaskResultNotice，不回 TalkToFriendTaskResultNotice）
    case 'TalkToFriendTask':
    case 1210:
      if (handleTalkToFriendTaskResult(store, message) !== 'ignored') {
        clearTalkToFriendTaskTimeout(message)
      }
      break
    // 手机任务
    case 'PhoneActionTask':
      break
    // 通过新客户验证 ok
    case 'AcceptCustomerTask': {
      const normalized = normalizeAcceptCustomerResult(message)
      store.commit('tools/UPDATE_NEW_FRIENDS', normalized)
      if (!normalized.Success && normalized.ErrMsg) {
        Message({
          type: 'warning',
          message: normalized.ErrMsg,
          duration: 2500
        })
      }
      break
    }
    // 转发：失败时提示（成功已在下发时 toast）
    case 'ForwardMsgTask':
    case 'ForwardMultiTask':
      if (!message.Success) {
        Message({
          type: 'warning',
          message: message.ErrMsg || '转发失败',
          duration: 2500
        })
      }
      break
    // 开红包/收转账：只清 pending，成功/失败 toast 以 TakeMoneyTaskResultNotice 为准
    // （TaskResultNotice.Success 在金额为 0 时仍可能为 true，会误报「开红包成功」）
    case 'TakeLuckyMoneyTask':
    case 'TakeLuckyMoney':
    case 'UnknownMsg':
    case 0:
    case 1263:
      if (message && (message.TaskId != null || message.taskId != null)) {
        clearPendingTakeMoneyTask(message.TaskId != null ? message.TaskId : message.taskId)
      }
      break
    default:
      console.log('taskResultMap', message)
      // 防御：未识别 TaskType 时勿把 hook 英文 has added 弹成 toast
      if (!message.Success && /^has added$/i.test(String(message.ErrMsg || '').trim())) {
        break
      }
      Message({
        type: message.Success ? 'success' : 'warning',
        message: message.Success
          ? '任务执行成功！'
          : (message.ErrMsg || '任务执行失败！'),
        duration: 2000
      })
      break
  }
}
export default {
  taskResultMap
}
