import { expect } from 'chai'
import { isDesktopBuild, isDesktopMode } from '@/utils/desktopMode'

describe('desktopMode', () => {
  it('isDesktopMode 对 electron/tauri 为 true，对 web/空 为 false', () => {
    expect(isDesktopMode('electron')).to.equal(true)
    expect(isDesktopMode('tauri')).to.equal(true)
    expect(isDesktopMode('web')).to.equal(false)
    expect(isDesktopMode('')).to.equal(false)
    expect(isDesktopMode(null)).to.equal(false)
  })

  it('isDesktopBuild 读 process.env.VUE_APP_CURRENTMODE', () => {
    const prev = process.env.VUE_APP_CURRENTMODE
    process.env.VUE_APP_CURRENTMODE = 'tauri'
    expect(isDesktopBuild()).to.equal(true)
    process.env.VUE_APP_CURRENTMODE = 'web'
    expect(isDesktopBuild()).to.equal(false)
    process.env.VUE_APP_CURRENTMODE = prev
  })
})
