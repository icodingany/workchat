import { expect } from 'chai'
import { getWebSocketDeviceType } from '@/utils/deviceDetector'

describe('getWebSocketDeviceType', () => {
  const originalCapacitor = window.Capacitor
  const originalLegacyCapacitor = window.__CAPACITOR__
  const originalWorkchatCapacitor = window.WorkchatCapacitor

  afterEach(() => {
    window.Capacitor = originalCapacitor
    window.__CAPACITOR__ = originalLegacyCapacitor
    window.WorkchatCapacitor = originalWorkchatCapacitor
  })

  it('识别 Capacitor 8 原生运行时为 mobile_app', () => {
    window.Capacitor = {
      isNativePlatform: () => true
    }

    expect(getWebSocketDeviceType()).to.equal('mobile_app')
  })

  it('Capacitor Web 运行时保持浏览器设备类型', () => {
    window.Capacitor = {
      isNativePlatform: () => false
    }

    expect(getWebSocketDeviceType()).to.not.equal('mobile_app')
  })
})
