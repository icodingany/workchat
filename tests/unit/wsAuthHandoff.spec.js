/**
 * 切客服端时 wsAuthInProgress 与 previewHandle / App.vue 协调（防 admin↔conversation 来回跳）
 */
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

describe('wsAuthInProgress handoff（防来回跳）', () => {
  it('previewHandle：wsAuthInProgress 时不抢先 SET_ACTIVE_PANEL', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/websocket/handler/previewHandle.js'),
      'utf8'
    )
    expect(source).to.include('wsAuthInProgress')
    expect(source).to.include('handoffToModeSwitch')
    expect(source).to.match(/if \(!handoffToModeSwitch\)[\s\S]*SET_ACTIVE_PANEL/)
  })

  it('App.vue：wsAuthInProgress 时不 ensureValidActivePanel 打回 admin', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
    expect(source).to.include('wsAuthInProgress')
    expect(source).to.match(/wsAuthInProgress[\s\S]*ensureValidActivePanel/)
  })

  it('AppModeSwitch：未落到 /conversation 时不 SET_ACTIVE_PANEL client', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AppModeSwitch.vue'),
      'utf8'
    )
    expect(source).to.include('landedFinal')
    expect(source).to.match(/if \(!landedFinal\)[\s\S]*return/)
  })
})
