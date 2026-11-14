import { expect } from 'chai'
import { createDesktopBridge, ALLOWED_IPC_CHANNELS } from '@/desktop/bridge'

describe('desktopBridge', () => {
  it('白名单包含 operations / open-external-url / updater 通道', () => {
    expect(ALLOWED_IPC_CHANNELS.has('operations')).to.equal(true)
    expect(ALLOWED_IPC_CHANNELS.has('open-external-url')).to.equal(true)
    expect(ALLOWED_IPC_CHANNELS.has('check-for-updates')).to.equal(true)
    expect(ALLOWED_IPC_CHANNELS.has('updater-event')).to.equal(true)
  })

  it('send(operations, op) 调用 invoke desktop_operation', async () => {
    const calls = []
    const bridge = createDesktopBridge({
      invoke: async (cmd, args) => {
        calls.push([cmd, args])
        return null
      },
      listen: async () => () => {}
    })
    bridge.ipcRenderer.send('operations', 'login')
    expect(calls[0][0]).to.equal('desktop_operation')
    expect(calls[0][1]).to.deep.equal({ op: 'login' })
  })

  it('非白名单 channel 抛错', () => {
    const bridge = createDesktopBridge({
      invoke: async () => null,
      listen: async () => () => {}
    })
    expect(() => bridge.ipcRenderer.send('not-allowed')).to.throw(/not allowed/i)
  })

  it('shell.openExternal 走 open_external_url', async () => {
    const calls = []
    const bridge = createDesktopBridge({
      invoke: async (cmd, args) => {
        calls.push([cmd, args])
        return true
      },
      listen: async () => () => {}
    })
    await bridge.shell.openExternal('https://example.com')
    expect(calls[0][0]).to.equal('open_external_url')
    expect(calls[0][1]).to.deep.equal({ url: 'https://example.com' })
  })
})
