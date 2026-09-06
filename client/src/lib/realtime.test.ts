import { describe, expect, it, vi } from 'vitest'
import { retryDelay } from './realtime'

describe('realtime reconnect', () => {
  it('backs off and caps reconnect delays', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(retryDelay(0)).toBe(500)
    expect(retryDelay(20)).toBe(30000)
    vi.restoreAllMocks()
  })
})
