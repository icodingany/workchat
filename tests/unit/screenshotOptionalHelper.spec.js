import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'

// Exercise the actual IPC case without starting an Electron window.
const source = fs.readFileSync(path.resolve('electron/main/index.js'), 'utf8')
const start = source.indexOf("case 'screencap': {")
const end = source.indexOf('\n            default:', start)
const execute = new Function('fs', 'path', 'process', '__dirname', 'execFile', 'win', 'console',
  `switch ('screencap') { ${source.slice(start, end)} }`)

function setup(exists) {
  const child = new EventEmitter()
  const execFile = vi.fn(() => child)
  const win = { webContents: { paste: vi.fn() } }
  const log = { warn: vi.fn() }
  execute({ existsSync: () => exists }, path, { env: { NODE_ENV: 'development' }, cwd: () => '/app' },
    '/app/out/main', execFile, win, log)
  return { child, execFile, win, log }
}

describe('optional desktop screenshot helper', () => {
  it('does not spawn a missing helper in the public distribution', () => {
    const { execFile, log } = setup(false)
    expect(execFile).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalled()
  })

  it('handles a helper launch error without an uncaught error event', () => {
    const { child, log } = setup(true)
    expect(() => child.emit('error', new Error('ENOENT'))).not.toThrow()
    expect(log.warn).toHaveBeenCalled()
  })

  it('pastes only after a successful capture', () => {
    const { child, win } = setup(true)
    child.emit('exit', 0)
    expect(win.webContents.paste).not.toHaveBeenCalled()
    child.emit('exit', 1)
    expect(win.webContents.paste).toHaveBeenCalledTimes(1)
  })
})
