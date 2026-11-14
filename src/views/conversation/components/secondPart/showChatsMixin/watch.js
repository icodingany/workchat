import { convDiag } from '@/utils/convClickDiag'
import { sameWxId } from '@/utils/wechat'

export default {
  watch: {
    // 对齐 kelailaichatpc openSessionKey：切会话立刻 RESET + setTimeout(0) 秒开，不用 180ms 防抖当主路径
    currentFriendId: {
      immediate: true,
      handler(newId) {
        this.clearOpenSessionHistoryTimers()
        this._openSessionLoadGen += 1
        const gen = this._openSessionLoadGen
        const wxId = this.currentWeChatId
        this.$store.commit('conversation/RESET_CURRENT_CHATS', {
          wxId,
          convId: newId
        })
        convDiag('[open-session] schedule', {
          gen,
          newId: newId != null ? String(newId) : '',
          wxId: wxId != null ? String(wxId) : ''
        })
        if (!newId) {
          convDiag('[open-session] skip empty friendId', { gen })
          return
        }
        this.scheduleOpenSessionHistoryLoad(wxId, newId, gen)
      }
    }
  }
}
