import { expect } from 'chai'
import {
  isMsgFieldDebugEnabled,
  snapshotMsgFields,
  logMsgFieldDebug,
  logMsgFieldAnomaly
} from '@/utils/msgFieldDebug'

describe('msgFieldDebug', () => {
  beforeEach(() => {
    localStorage.clear()
    delete window.__WORKCHAT_MSG_FIELD_DEBUG__
    // reset per-stage counters between tests
    logMsgFieldDebug('reset-stage', {})
  })

  it('默认关闭', () => {
    expect(isMsgFieldDebugEnabled()).to.equal(false)
  })

  it('localStorage 开关', () => {
    localStorage.setItem('workchat.msgFieldDebug', '1')
    expect(isMsgFieldDebugEnabled()).to.equal(true)
  })

  it('window 全局开关', () => {
    window.__WORKCHAT_MSG_FIELD_DEBUG__ = true
    expect(isMsgFieldDebugEnabled()).to.equal(true)
  })

  it('URL 参数 msgFieldDebug=1', () => {
    const orig = window.location
    delete window.location
    window.location = { search: '?msgFieldDebug=1' }
    expect(isMsgFieldDebugEnabled()).to.equal(true)
    window.location = orig
  })

  it('snapshotMsgFields 双读 camelCase/PascalCase', () => {
    const snap = snapshotMsgFields({
      contentType: null,
      ContentType: '1',
      content: '你好世界',
      msgRemoteId: '99'
    })
    expect(snap.ContentType).to.equal('1')
    expect(snap.contentType_raw).to.equal(null)
    expect(snap.Content).to.include('你好')
    expect(snap.MsgRemoteId).to.equal('99')
  })

  it('snapshotMsgFields 空对象/非对象', () => {
    expect(snapshotMsgFields(null)).to.deep.equal({ chat: null })
    expect(snapshotMsgFields(undefined)).to.deep.equal({ chat: undefined })
  })

  it('logMsgFieldDebug 关闭时不输出', () => {
    const warn = console.warn
    let called = false
    console.warn = () => {
      called = true
    }
    logMsgFieldDebug('http.raw', { x: 1 })
    console.warn = warn
    expect(called).to.equal(false)
  })

  it('logMsgFieldAnomaly 缺类型缺正文时输出', () => {
    localStorage.setItem('workchat.msgFieldDebug', '1')
    const lines = []
    const warn = console.warn
    console.warn = (...args) => lines.push(args.join(' '))
    logMsgFieldAnomaly('decode.default', { contentType: null, ContentType: '' })
    console.warn = warn
    expect(lines.some((l) => l.includes('[msg-field-debug][decode.default]'))).to.equal(true)
  })

  it('logMsgFieldAnomaly 类型正文齐全时不输出', () => {
    localStorage.setItem('workchat.msgFieldDebug', '1')
    const lines = []
    const warn = console.warn
    console.warn = (...args) => lines.push(args.join(' '))
    logMsgFieldAnomaly('decode.default', { ContentType: 'Text', Content: 'hi' })
    console.warn = warn
    expect(lines.length).to.equal(0)
  })

  it('同阶段日志超过上限后不再输出', () => {
    localStorage.setItem('workchat.msgFieldDebug', '1')
    const lines = []
    const warn = console.warn
    console.warn = (...args) => lines.push(args.join(' '))
    for (let i = 0; i < 35; i++) {
      logMsgFieldDebug('cap-stage', { i })
    }
    console.warn = warn
    expect(lines.filter((l) => l.includes('[cap-stage]')).length).to.be.at.most(31)
  })
})
