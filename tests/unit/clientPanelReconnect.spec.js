/**
 * 客服端 WS 重连期间勿误切管理端（对齐 kelailaichatpc）
 */
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

describe('客服端重连不误切管理端', () => {
  it('App.vue：activePanel=client 时 ensureValidActivePanel 不强制 admin', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
    expect(source).to.match(
      /if \(this\.activePanel === 'client'\) \{[\s\S]*tryAutoDeviceAuth\(\)[\s\S]*return/
    )
    expect(source).to.match(
      /ensureValidActivePanel\(\) \{[\s\S]*if \(this\.activePanel === 'client'\) return/
    )
  })

  it('App.vue：客服壳不依赖 webSocketToken 才渲染', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
    expect(source).to.include("v-if=\"activePanel === 'client'\"")
    expect(source).not.to.include("activePanel === 'client' && webSocketToken")
  })

  it('router：activePanel=client 且无 wsToken 时放行客服路由', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/router/index.js'), 'utf8')
    expect(source).to.match(/activePanel === 'client'[\s\S]*next\(\)/)
  })
})
