import { describe, expect, it, vi } from 'vitest'
import { RealtimeClient, retryDelay } from './realtime'

describe('realtime reconnect', () => {
  it('backs off and caps reconnect delays', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(retryDelay(0)).toBe(500)
    expect(retryDelay(20)).toBe(30000)
    vi.restoreAllMocks()
  })
  it('does not reconnect after the client is closed', () => {
    vi.useFakeTimers()
    const sockets: { onclose?: () => void; close: () => void }[] = []
    class Socket {
      onclose?: () => void
      constructor() { sockets.push(this) }
      close() { this.onclose?.() }
    }
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('WebSocket', Socket)
    const client = new RealtimeClient(); client.connect(); sockets[0].onclose?.(); client.close()
    vi.runAllTimers()
    expect(sockets).toHaveLength(1)
    vi.unstubAllGlobals(); vi.useRealTimers()
  })
})
