/**
 * WebSocket 连接管理模块
 * <p>
 * 负责与后端 WebSocket 服务器的连接管理，包括：
 * <ul>
 *   <li>创建 WebSocket 连接</li>
 *   <li>发送消息到服务器</li>
 *   <li>处理连接状态变化（打开、关闭、错误）</li>
 *   <li>接收服务器推送的消息</li>
 * </ul>
 * <p>
 * <b>消息流程：</b>
 * <pre>
 * 客户端 → [WebSocket] → 服务器 → [手机SDK] → 微信
 *         ↖───────────────────────────────────────┙
 * </pre>
 * <p>
 * <b>状态码：</b>
 * <ul>
 *   <li>0：CONNECTING - 正在连接</li>
 *   <li>1：OPEN - 已打开</li>
 *   <li>2：CLOSING - 正在关闭</li>
 *   <li>3：CLOSED - 已关闭</li>
 * </ul>
 */
import store from '../store'
import msgHandler from './msgHandler'
import { enqueueOutboundMessage } from './outboundQueue'

let WebSocketObj = null // WebSocket 实例
/** 断线/未认证时暂存的待发 WS 帧 */
let messageQueue = []
/**
 * 自动重连相关状态
 * <p>
 * 原先 reconnect() / 心跳检测全部被注释掉，连接一旦掉过一次就永久失联，
 * 必须刷新页面。这里加一个最小化重连：onclose/onerror 触发后，
 * 按固定间隔重试最多 MAX_RECONNECT_ATTEMPTS 次，期间不弹"请重新登录"框；
 * 彻底失败后再把状态置 3，由 App.vue 的监听弹框提示用户。
 * <p>
 * <b>注意</b>：重连后不会自动重新走 deviceAuthReq 登录流程，
 * 适用于服务器端会话仍有效的瞬时网络抖动场景；
 * 长时间掉线 / 服务端踢下线 / token 过期等场景仍需用户手动重登。
 */
let currentUrl = '' // 记住当前 url，供重连复用
let reconnectTimer = null // 重连定时器
let reconnectAttempts = 0 // 已重连次数
let intentionalClose = false // 主动关闭（退出登录），不再重连
/** 「账号已在别处登录」等场景：禁止自动重连 */
let forbidReconnectFlag = false
/** 连接超时监控：onopen 迟迟不到则强制关闭，避免长期卡在 state=0 */
let connectWatchTimer = null
const MAX_RECONNECT_ATTEMPTS = 4
const RECONNECT_INTERVAL = 5000
const CONNECT_WATCH_TIMEOUT_MS = 10000

function clearConnectWatchTimer() {
    if (connectWatchTimer) {
        clearTimeout(connectWatchTimer)
        connectWatchTimer = null
    }
}

/**
 * 连接已 OPEN 且已认证时，将队列中的消息发出。
 */
function flushMessageQueueIfAuthenticated() {
  try {
    if (!WebSocketObj || WebSocketObj.readyState !== WebSocketObj.OPEN) return
    if (!store.state.webSocketToken) return
    if (!Array.isArray(messageQueue) || messageQueue.length === 0) return

    const queue = messageQueue
    messageQueue = []

    queue.forEach((m) => {
      try {
        if (m && m.MsgType === 'DeviceAuthReq') return
        if (WebSocketObj && WebSocketObj.readyState === WebSocketObj.OPEN) {
          WebSocketObj.send(JSON.stringify(m))
        } else {
          enqueueOutboundMessage(messageQueue, m, { mode: 'front' })
        }
      } catch (e) {
        console.warn('flushMessageQueue 发送失败，将重新入队', e)
        enqueueOutboundMessage(messageQueue, m, { mode: 'front' })
      }
    })
  } catch (e) {
    console.warn('flushMessageQueueIfAuthenticated failed:', e)
  }
}

try {
  store.subscribe((mutation) => {
    if (mutation && mutation.type === 'SET_WEBSOCKET_TOKEN') {
      flushMessageQueueIfAuthenticated()
    }
  })
} catch (_) {
  /* ignore */
}

/** 被踢下线后禁止自动重连，避免反复弹错 */
export function forbidReconnect() {
  forbidReconnectFlag = true
  intentionalClose = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

/** 被踢下线等场景已禁止重连（避免 tryAutoDeviceAuth 误触发） */
export function isReconnectForbidden() {
  return forbidReconnectFlag
}

/**
 * 创建 WebSocket 连接
 * <p>
 * 创建 WebSocket 实例并设置事件处理器：
 * <ul>
 *   <li>onclose：连接关闭时触发，更新状态为 3</li>
 *   <li>onerror：连接异常时触发</li>
 *   <li>onopen：连接打开时触发，更新状态为 1</li>
 *   <li>onmessage：收到消息时触发，调用 msgHandler 处理</li>
 * </ul>
 *
 * @param {String} url websocket地址（必传，通常来自 VUE_APP_WEBSOCKET_URL）
 */
function createWebSocket(url) {
    if (!url) {
        console.error('createWebSocket: url 不能为空')
        return
    }
    console.log('webSocketUrl', url)
    currentUrl = url
    // 显式调用 createWebSocket 视为"想要一条新连接"，复位主动关闭标记，
    // 让后续可能的 onclose 重新参与重连判定（退出登录→重新创建场景）
    intentionalClose = false
    forbidReconnectFlag = false
    // 旧实例已关闭/关闭中时须丢弃再建，否则「已存在」分支会导致切客服端永远等不到 OPEN
    if (WebSocketObj) {
        const rs = WebSocketObj.readyState
        if (rs === WebSocketObj.OPEN || rs === WebSocketObj.CONNECTING) {
            console.log('WebSocket 已在连接或已打开', rs)
            return
        }
        try {
            WebSocketObj.close()
        } catch (e) {
            /* ignore */
        }
        WebSocketObj = null
    }
    store.commit('SET_WEB_SOCKET_STATE', 0)
    clearConnectWatchTimer()
    connectWatchTimer = setTimeout(() => {
        connectWatchTimer = null
        if (store.state.webSocketState !== 0) return
        console.warn('WebSocket 连接超时，重置为断开状态，等待重连')
        store.commit('SET_WEB_SOCKET_STATE', 3)
        try {
            if (
                WebSocketObj &&
                WebSocketObj.readyState !== WebSocketObj.CLOSED &&
                WebSocketObj.readyState !== WebSocketObj.CLOSING
            ) {
                WebSocketObj.close()
            }
        } catch (e) {
            /* ignore */
        }
        WebSocketObj = null
        if (!intentionalClose && !forbidReconnectFlag) {
            scheduleReconnect()
        }
    }, CONNECT_WATCH_TIMEOUT_MS)
    WebSocketObj = new WebSocket(url)
    // websocket 关闭
    WebSocketObj.onclose = () => {
        console.log('websocket关闭')
        if (intentionalClose) {
            store.commit('SET_WEB_SOCKET_STATE', 3)
            return
        }
        // 自动重连期间勿置 3：App.vue 监听到 3 会立刻弹「请重新登录」模态框，
        // 连点会话主线程卡顿触发瞬时断线时会被误判成假死。
        store.commit('SET_WEB_SOCKET_STATE', 0)
        // 断线后清 WS token，重连 onopen 会触发 tryAutoDeviceAuth 重新 DeviceAuth
        store.commit('SET_WEBSOCKET_TOKEN', '')
        try {
          localStorage.removeItem('validateToken')
        } catch (e) {
          /* ignore */
        }
        scheduleReconnect()
    }
    // websocket 出错
    WebSocketObj.onerror = (e) => {
        console.log('websocket异常', e)
        // onerror 后通常会接着触发 onclose，统一在 onclose 里调度重连，避免重复
    }
    // websocket 打开
    WebSocketObj.onopen = () => {
        // websocket打开
        console.log('websocket打开')
        clearConnectWatchTimer()
        store.commit('SET_WEB_SOCKET_STATE', 1)
        // 重连成功后清零计数；intentionalClose 状态也清掉（重新登录场景）
        reconnectAttempts = 0
        intentionalClose = false
        flushMessageQueueIfAuthenticated()
    }

    /**
     * 接收消息事件
     * <p>
     * 收到服务器推送的任何消息都说明当前连接是正常的。
     * 消息格式：{ msgType: 'xxx', message: '...' }
     */
    WebSocketObj.onmessage = (event) => {
        // 拿到任何消息都说明当前连接是正常的
        try {
            msgHandler(event)
        } catch (error) {
            console.warn('WebSocket 消息处理失败', error, event && event.data)
        }
    }
}

/**
 * 调度一次重连尝试
 * <p>
 * 触发条件：onclose（onerror 之后也会触发 onclose，统一从这里走）。
 * <p>
 * 终止条件：主动关闭（intentionalClose）或重试达到上限，
 * 之后不再调度，由 App.vue 的 webSocketState 监听器弹"请重新登录"框。
 */
function scheduleReconnect() {
    if (forbidReconnectFlag) {
        console.log('已禁止自动重连（如账号已在别处登录）')
        store.commit('SET_WEB_SOCKET_STATE', 3)
        return
    }
    if (intentionalClose) {
        console.log('主动关闭，不再重连')
        return
    }
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`重连已达上限 ${MAX_RECONNECT_ATTEMPTS} 次，停止重连`)
        store.commit('SET_WEB_SOCKET_STATE', 3)
        return
    }
    // 已存在 pending 的重连，不重复调度
    if (reconnectTimer) return
    reconnectAttempts++
    console.log(`将在 ${RECONNECT_INTERVAL}ms 后尝试第 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 次重连`)
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        // 旧实例可能仍残留，先丢弃再创建新的
        WebSocketObj = null
        createWebSocket(currentUrl)
    }, RECONNECT_INTERVAL)
}

// 心跳检测（已禁用）
// const heartCheck = {
//   timeout: 5000, // 心跳检测时长
//   timeoutObj: null, //  定时变量
//   serverTimeoutObj: null, // 服务器超时
//   start: function() {
//     // console.log('start')
//     if (WebSocketObj.readyState === 1 && store.getters.login) {
//       const that = this
//       // 重置心跳
//       this.timeoutObj && clearTimeout(this.timeoutObj)
//       this.serverTimeoutObj && clearTimeout(this.serverTimeoutObj)
//       this.timeoutObj = setTimeout(function() {
//         // 这里发送一个心跳，后端收到后，返回一个心跳消息，
//         // console.log('当前的token:' + store.getters.token)
//         // console.log(WebSocketObj.readyState)
//         const msg = {
//           Id: 1001,
//           MsgType: 'HeartBeatReq',
//           AccessToken: store.getters.token
//         }
//         // console.log('下面是心跳：')
//         // console.log(msg)
//         sendSock(msg)
//         that.serverTimeoutObj = setTimeout(function() {
//           // console.log('服务器返回超时，关闭websocket')
//           WebSocketObj.close()
//         }, that.timeout)
//       }, this.timeout)
//     }
//   }
// }

/**
 * 发送消息到服务器
 * <p>
 * 将 JavaScript 对象序列化为 JSON 字符串后通过 WebSocket 发送。
 * <p>
 * <b>消息格式：</b>
 * <pre>
 * {
 *   Id: 1001,
 *   MsgType: 'GetWeChatsReq',
 *   Content: { ... },
 *   AccessToken: 'xxx'
 * }
 * </pre>
 *
 * @param {*} agentData 要发送的消息对象
 * @returns {Boolean} true=已发送；false=连接未就绪，调用方应据此决定是否回滚 UI 状态
 */
function prepareOutboundMessage(agentData) {
    if (!agentData || typeof agentData !== 'object') return agentData
    const next = { ...agentData }
    const content = next.Content
    if (content != null && typeof content === 'object') {
        next.Content = JSON.stringify(content)
    }
    if (!next.AccessToken && store.state.webSocketToken) {
        next.AccessToken = store.state.webSocketToken
    }
    return next
}

function sendSock(agentData) {
    const payload = prepareOutboundMessage(agentData)
    if (WebSocketObj && WebSocketObj.readyState === WebSocketObj.OPEN) {
        // 未认证前仅允许 DeviceAuthReq，其余业务帧入队等待 token
        if (payload && payload.MsgType !== 'DeviceAuthReq' && !store.state.webSocketToken) {
            enqueueOutboundMessage(messageQueue, payload)
            return true
        }
        try {
            WebSocketObj.send(JSON.stringify(payload))
            return true
        } catch (e) {
            console.warn('WebSocket.send 失败，消息入队', e)
            enqueueOutboundMessage(messageQueue, payload, { mode: 'front' })
            return true
        }
    }

    if (payload && payload.MsgType === 'DeviceAuthReq') {
        messageQueue = messageQueue.filter((m) => !(m && m.MsgType === 'DeviceAuthReq'))
    }
    enqueueOutboundMessage(messageQueue, payload)
    console.warn('websocket未就绪，消息已入队', {
        readyState: WebSocketObj && WebSocketObj.readyState,
        msgType: agentData && agentData.MsgType,
        queueLength: messageQueue.length
    })
    return true
}

/**
 * 关闭 WebSocket 连接
 * <p>
 * 关闭连接并清空实例，用于用户退出登录时清理资源。
 * 标记 intentionalClose 以避免 onclose 触发自动重连。
 */
function closeWebsocket() {
    intentionalClose = true
    if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
    reconnectAttempts = 0
    if (WebSocketObj) {
        WebSocketObj.close()
    }
    WebSocketObj = null
}

/**
 * 手动重连加密连接（重置自动重连计数与定时器后重新建连）
 *
 * @param {String} [url] websocket 地址，默认复用 currentUrl
 * @returns {Boolean} 是否已发起重连
 */
function retryWebSocketConnection(url) {
    const wsUrl = url || currentUrl
    if (!wsUrl) {
        console.error('retryWebSocketConnection: url 不能为空')
        return false
    }
    intentionalClose = false
    reconnectAttempts = 0
    if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
    if (WebSocketObj) {
        try {
            WebSocketObj.close()
        } catch (e) {
            /* ignore */
        }
        WebSocketObj = null
    }
    createWebSocket(wsUrl)
    return true
}

export { sendSock, createWebSocket, closeWebsocket, retryWebSocketConnection }
