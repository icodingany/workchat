import { isSendFailedChat } from '@/utils/localSendPreview'
import {
  shouldTriggerPhoneHistorySync,
  buildDigestPreviewChat,
  buildStrangerTipChat,
  messagesHaveStrangerTip,
  OPEN_SESSION_POLL_INTERVAL_MS,
  OPEN_SESSION_POLL_MAX_MS
} from '@/utils/openSessionHistory'
import { triggerHistoryPull } from '@/api/httpApi'
import { convDiag } from '@/utils/convClickDiag'
import { sameWxId, sameId } from '@/utils/wechat'

export default {
  methods: {
    clearOpenSessionHistoryTimers() {
if (this._openSessionDebounceTimer) {
        clearTimeout(this._openSessionDebounceTimer)
        this._openSessionDebounceTimer = null
      }
      if (this._historyRetryTimer) {
        clearTimeout(this._historyRetryTimer)
        this._historyRetryTimer = null
      }
      if (this._historyPollTimer) {
        clearTimeout(this._historyPollTimer)
        this._historyPollTimer = null
      }
      if (this._coverageFillTimer) {
        clearTimeout(this._coverageFillTimer)
        this._coverageFillTimer = null
      }
    },
    scheduleOpenSessionHistoryLoad(wxId, convId, gen) {
const stillCurrent = () =>
        gen === this._openSessionLoadGen &&
        sameWxId(this.currentWeChatId, wxId) &&
        sameId(this.currentFriendId, convId)

      const run = async () => {
        if (!stillCurrent()) {
          convDiag('[open-session] abort before dispatch', {
            gen,
            loadGen: this._openSessionLoadGen,
            expect: String(convId),
            actual: this.currentFriendId != null ? String(this.currentFriendId) : ''
          })
          return
        }
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
        convDiag('[open-session] dispatch OpenSessionChats', { gen, convId: String(convId) })
        let result
        try {
          // IndexedDB 卡住时不阻塞 HTTP：最多等 1.5s
          result = await Promise.race([
            this.$store.dispatch('conversation/OpenSessionChats', { wxId, convId }),
            new Promise((resolve) => {
              setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 1500)
            })
          ])
          if (result && result.reason === 'timeout') {
            convDiag('[open-session] OpenSession 超时，改走纯 HTTP', { gen, convId: String(convId) })
            if (stillCurrent()) {
              result = await this.$store.dispatch('conversation/LoadChatsByHttp', {
                wxId,
                convId,
                openSessionFast: true
              })
            }
          }
        } catch (e) {
          convDiag('[open-session] OpenSessionChats 异常', {
            gen,
            err: String(e && e.message ? e.message : e)
          })
          return
        }
        const costMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
        if (!stillCurrent()) {
          convDiag('[open-session] abort after await', {
            gen,
            loadGen: this._openSessionLoadGen,
            costMs,
            reason: result && result.reason
          })
          return
        }
        this.setBottom()
        const msgs = (this.currentChats && this.currentChats.Messages) || []
        convDiag('[open-session] done', {
          gen,
          costMs,
          ok: !!(result && result.ok),
          reason: result && result.reason,
          msgLen: msgs.length
        })
        if (stillCurrent() && msgs.length) {
          this.$nextTick(() => this.prefetchRecentPictureResources())
        }
        if (result && !result.ok && (result.reason === 'missing-args' || result.reason === 'http-error')) {
          const msg =
            result.reason === 'missing-args'
              ? '登录态不完整（缺少账号信息），请重新登录'
              : '历史消息加载失败，请检查网络或稍后重试'
          this.$message.warning(msg)
          convDiag('[open-session] fail toast', { reason: result.reason, msg })
          return
        }
        const conv = this.currentFriend || {}
        // 非好友：Digest/不在通讯录 → 注入本地 System tip（企微常无真实 System 历史）
        const strangerTip = buildStrangerTipChat(conv, wxId, convId, this.contactsMap, msgs)
        if (strangerTip && !messagesHaveStrangerTip(msgs, strangerTip.Content)) {
          this.$store.dispatch('conversation/InsertLocalChat', strangerTip)
        }
        // 打开会话路径禁止自动「手机同步 / coverage 补洞」：
        // 第一下打开后这些异步会与第二下 OpenSession 叠在主线程，表现为「第二下就卡死」。
        // 需要补历史请用工具栏「同步消息」（manualSyncPhoneHistory）。
        if (!msgs.length) {
          const preview = buildDigestPreviewChat(conv, wxId, convId)
          if (preview && shouldTriggerPhoneHistorySync(conv, msgs)) {
            this.$store.dispatch('conversation/InsertLocalChat', preview)
          }
          convDiag('[open-session] empty session (no auto phone sync)', {
            gen,
            convId: String(convId),
            costMs,
            reason: result && result.reason,
            wouldSync: shouldTriggerPhoneHistorySync(conv, msgs)
          })
        } else {
          convDiag('[open-session] skip auto phone/coverage', {
            gen,
            convId: String(convId),
            msgLen: msgs.length
          })
        }
      }

      this._openSessionDebounceTimer = setTimeout(() => {
        this._openSessionDebounceTimer = null
        run().catch(() => {})
      }, 0)
    },
    scheduleCoverageGapFill(wxId, convId, gen) {
const sessionKey = `${wxId}|${convId}`
      const now = Date.now()
      if (this._coverageFillSessionKey === sessionKey && now - this._coverageFillLastAt < 30000) {
        return
      }
      if (this._coverageFillTimer) {
        clearTimeout(this._coverageFillTimer)
      }
      this._coverageFillTimer = setTimeout(() => {
        this._coverageFillTimer = null
        if (gen != null && this._openSessionLoadGen !== gen) return
        if (!sameId(this.currentFriendId, convId)) return
        this._coverageFillSessionKey = sessionKey
        this._coverageFillLastAt = Date.now()
        this.$store.dispatch('conversation/FillCoverageGaps', { wxId, convId }).catch(() => {})
      }, 800)
    },
    startPhoneHistorySyncPoll(wxId, convId, localId, gen, opts = {}) {
      const force = !!(opts && opts.force)
      const baselineMsgs = (this.currentChats && this.currentChats.Messages) || []
      const baseline = baselineMsgs.length
      const baselineFail = baselineMsgs.filter((m) => isSendFailedChat(m)).length
      const now = Date.now()
      if (!this._historySyncToastAt || now - this._historySyncToastAt > 3000) {
        this._historySyncToastAt = now
        this.$message.info(
          force || baseline > 0 ? '正在从手机同步消息…' : '本地暂无历史，正在从手机同步…'
        )
      }
      triggerHistoryPull(wxId, convId).catch((e) => {
        convDiag('[open-session] triggerHistoryPull 失败', {
          err: String(e && e.message ? e.message : e)
        })
      })
      const started = Date.now()
      let retriedPhone = false
      // 缩短轮询：最多约 5s，降低连点堆积；强制同步稍长一点
      const maxMs = Math.min(OPEN_SESSION_POLL_MAX_MS, force ? 8000 : 5000)
      const tick = () => {
        if (this._openSessionLoadGen !== gen || !sameId(this.currentFriendId, convId)) return
        this.$store.dispatch('conversation/LoadChatsByHttp', { wxId, convId }).then(() => {
          if (this._openSessionLoadGen !== gen || !sameId(this.currentFriendId, convId)) return
          const msgs = (this.currentChats && this.currentChats.Messages) || []
          const failCnt = msgs.filter((m) => isSendFailedChat(m)).length
          // 空库：有消息即停；强制/已有基线：条数增加、或失败红点变多（历史补 Flag）
          if (!force && baseline === 0 && msgs.length > 0) {
            convDiag('[open-session] 手机同步已出消息', {
              convId: String(convId),
              msgLen: msgs.length
            })
            this.setBottom()
            return
          }
          if (force && (msgs.length > baseline || failCnt > baselineFail)) {
            convDiag('[open-session] 强制同步有更新', {
              convId: String(convId),
              from: baseline,
              to: msgs.length,
              failFrom: baselineFail,
              failTo: failCnt
            })
            this.setBottom()
            this.$message.success(
              failCnt > baselineFail ? '已同步发送失败状态' : '已同步到新消息'
            )
            return
          }
          if (Date.now() - started >= maxMs) {
            convDiag('[open-session] 手机同步超时', {
              convId: String(convId),
              baseline,
              msgLen: msgs.length,
              failCnt,
              force
            })
            if (baseline === 0 && msgs.length === 0) {
              this.$message.warning('历史同步超时，可稍后重新打开会话')
            } else if (force) {
              this.$message.info(
                failCnt > 0
                  ? '同步完成'
                  : '同步完成（未拿到失败标记，请确认手机在线后重试）'
              )
              this.setBottom()
            }
            return
          }
          if (!retriedPhone && Date.now() - started >= 3000) {
            retriedPhone = true
            triggerHistoryPull(wxId, convId).catch(() => {})
          }
          this._historyPollTimer = setTimeout(tick, OPEN_SESSION_POLL_INTERVAL_MS)
        })
      }
      this._historyPollTimer = setTimeout(tick, OPEN_SESSION_POLL_INTERVAL_MS)
    },
    manualSyncPhoneHistory() {
const wxId = String(this.currentWeChatId || '').trim()
      const convId = String(this.currentFriendId || '').trim()
      if (!wxId || !convId) {
        this.$message.warning('请先打开会话')
        return
      }
      this.clearOpenSessionHistoryTimers()
      const gen = (this._openSessionLoadGen = (this._openSessionLoadGen || 0) + 1)
      const localId = this.currentConvLocalId
      const digest = this.currentFriend && this.currentFriend.Digest
      convDiag('[manual-sync] start', { convId, digest: digest ? String(digest).slice(0, 40) : '' })
      this.startPhoneHistorySyncPoll(wxId, convId, localId, gen, { force: true })
    },
    getMoreMessages() {
const el = document.getElementById('show-chat')
      if (!el) return
      const st = el.scrollTop
      const sh = el.scrollHeight
      const ch = el.clientHeight

      if (!(st === 0 && sh > ch)) {
        const { WxId, ConvId, Messages } = this.currentChats || {}
        if (WxId && ConvId && Array.isArray(Messages) && Messages.length >= 2) {
          this.scheduleCoverageGapFill(WxId, ConvId, this._openSessionLoadGen)
        }
        return
      }

      const { WxId, ConvId, Messages, HasMore, NextCursor } = this.currentChats
      if (!HasMore) {
        this.$message({
          type: 'warning',
          message: '没有更多数据！',
          duration: 1000
        })
        return
      }
      if (this.historyLoading) return

      let beforeTime = 0
      if (Array.isArray(Messages)) {
        for (const m of Messages) {
          const t = Number(m.MsgTime || m.CreateTime || 0)
          if (t > 0 && (beforeTime === 0 || t < beforeTime)) beforeTime = t
        }
      }
      if (!NextCursor && beforeTime <= 0) {
        this.$message({
          type: 'warning',
          message: '没有更多数据！',
          duration: 1000
        })
        return
      }

      this.historyLoading = true
      this.$store
        .dispatch('conversation/FetchOlderChatsByCursor', {
          wxId: WxId,
          convId: ConvId,
          beforeTime: NextCursor ? undefined : beforeTime,
          cursor: NextCursor || undefined
        })
        .then((result) => {
          if (result && !result.ok && result.reason === 'http-error') {
            this.$message.warning('加载更多历史消息失败，请稍后重试')
          }
          const t = setTimeout(() => {
            const box = document.getElementById('show-chat')
            if (box) box.scrollTop = 5
            clearTimeout(t)
          }, 100)
        })
        .finally(() => {
          this.historyLoading = false
        })
    },
    setBottom() {
this.scheduleStickBottom()
    },
    scheduleStickBottom() {
const run = () => {
        const container = document.getElementById('show-chat')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }
      run()
      this.$nextTick(run)
    }
  }
}
