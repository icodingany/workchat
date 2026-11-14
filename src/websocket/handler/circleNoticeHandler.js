
import { ElMessage as Message } from 'element-plus'


//  发送朋友圈结果通知 ok
export function postSnsTaskResultNoticeHandler(message) {
  if (message.Success) {
    Message({
      type: 'success',
      message: '朋友圈发送成功！',
      duration: 1000
    })
  } else {
    Message({
      type: 'warning',
      message: '朋友圈发送失败！',
      duration: 1000
    })
  }
}

