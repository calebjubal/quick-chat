import { describe, expect, it } from 'vitest'
import { clientSocketEventSchema } from '@quickchat/contracts'

describe('realtime protocol', () => {
  it('rejects unversioned arbitrary socket messages', () => {
    expect(clientSocketEventSchema.safeParse({ type: 'message.create' }).success).toBe(false)
    expect(clientSocketEventSchema.safeParse({ type: 'ping', requestId: crypto.randomUUID(), sentAt: 1 }).success).toBe(true)
  })
})
