import { describe, expect, it, vi, beforeEach } from 'vitest'

const { sendSock } = vi.hoisted(() => ({ sendSock: vi.fn() }))

let mockSessionOwnerId = ''

vi.mock('@/websocket/websocket', () => ({ sendSock }))

vi.mock('@/utils/wsSessionOwner', () => ({
  claimWsSessionOwner: vi.fn(),
  getWsSessionOwnerId: () => mockSessionOwnerId
}))

// Partial mock: keep original exports, override only getWebSocketDeviceType
vi.mock('@/utils/deviceDetector', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getWebSocketDeviceType: () => 'pc'
  }
})

import { deviceAuthReq } from '@/api/webSocketApi'

describe('deviceAuthReq', () => {
  beforeEach(() => {
    sendSock.mockClear()
    mockSessionOwnerId = ''
  })

  it('sends credential with deviceType (no sessionOwnerId when empty)', () => {
    deviceAuthReq('mobile-user', 'secret')

    expect(sendSock).toHaveBeenCalledTimes(1)
    const [message] = sendSock.mock.calls[0]
    expect(message).toMatchObject({
      Id: 1010,
      AccessToken: '',
      MsgType: 'DeviceAuthReq',
      Content: {
        AuthType: 2,
        Credential: btoa('mobile-user:secret:pc')
      }
    })
    expect(message.Content).not.toHaveProperty('DeviceType')
  })

  it('includes sessionOwnerId when present', () => {
    mockSessionOwnerId = 'ws_123_abc'
    deviceAuthReq('user', 'pass')

    const [message] = sendSock.mock.calls[0]
    expect(message.Content.Credential).toBe(btoa('user:pass:pc:ws_123_abc'))
  })

  it('returns false when websocket is not connected', () => {
    sendSock.mockReturnValueOnce(false)
    const sent = deviceAuthReq('user', 'pass')
    expect(sent).toBe(false)
    expect(sendSock).toHaveBeenCalledTimes(1)
  })
})