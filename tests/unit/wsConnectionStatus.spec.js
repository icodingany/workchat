/**
 * AsidePage 加密连接状态 UI 与 websocket 手动重连导出
 */
import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../../')

describe('ws connection status (AsidePage + websocket)', () => {
  it('AsidePage shows encrypted connection status and retry button', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/AsidePage.vue'), 'utf8')
    expect(src).toContain('加密连接：')
    expect(src).toContain('ws-status-box')
    expect(src).toContain('ws-loading-mask')
    expect(src).toContain('handleRetryWebSocket')
    expect(src).toContain('retryWebSocketConnection')
    expect(src).toContain('webSocketState')
  })

  it('websocket.js exports retryWebSocketConnection', () => {
    const src = fs.readFileSync(path.join(root, 'src/websocket/websocket.js'), 'utf8')
    expect(src).toContain('function retryWebSocketConnection')
    expect(src).toMatch(/export\s*\{[^}]*retryWebSocketConnection/)
  })

  it('websocket.js auto-reconnects up to 4 times then sets state=3', () => {
    const src = fs.readFileSync(path.join(root, 'src/websocket/websocket.js'), 'utf8')
    expect(src).toContain('const MAX_RECONNECT_ATTEMPTS = 4')
    expect(src).toContain('function scheduleReconnect')
    expect(src).toContain("store.commit('SET_WEB_SOCKET_STATE', 0)")
    expect(src).toContain("store.commit('SET_WEB_SOCKET_STATE', 3)")
    expect(src).toContain('reconnectAttempts >= MAX_RECONNECT_ATTEMPTS')
  })

  it('App.vue tryAutoDeviceAuth on reconnect when httpToken remains', () => {
    const src = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
    expect(src).toContain('tryAutoDeviceAuth')
    expect(src).toContain('isReconnectForbidden')
  })
})
