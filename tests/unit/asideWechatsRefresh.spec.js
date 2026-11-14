/**
 * 硬刷新后企微号列表兜底：HTTP 首屏 + WS 重连补拉
 */
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

describe('硬刷新后企微列表兜底', () => {
  it('App.vue：清 webSocketToken 时重置 autoDeviceAuthTried，允许重连后再补登', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
    expect(source).to.match(
      /webSocketToken\(newToken, oldToken\)[\s\S]*this\.autoDeviceAuthTried = false[\s\S]*tryAutoDeviceAuth\(\)/
    )
  })

  it('AsidePage.vue：列表空时 HTTP FetchWechatsList，WS 就绪时补发 GetWeChatsReq', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AsidePage.vue'), 'utf8')
    expect(source).to.include('loadWechatsIfEmpty()')
    expect(source).to.match(/loadWechatsIfEmpty\(\)[\s\S]*FetchWechatsList/)
    expect(source).to.match(/webSocketToken\(token\)[\s\S]*loadWechatsIfEmpty/)
    expect(source).to.match(/webSocketState\(state\)[\s\S]*loadWechatsIfEmpty/)
  })

  it('previewHandle：DeviceAuth 成功后 HTTP FetchWechatsList', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/websocket/handler/previewHandle.js'),
      'utf8'
    )
    expect(source).to.match(/FetchWechatsList/)
  })
})
