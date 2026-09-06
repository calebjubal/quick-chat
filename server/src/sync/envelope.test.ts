import { describe, expect, it } from 'vitest'
import { websocketEnvelopeSchema } from '@quickchat/contracts'
import { liveEventEnvelope } from './envelope.js'

describe('live event envelopes', () => {
  it('turns a committed message into a valid socket envelope', () => {
    const envelope = liveEventEnvelope('2eb77c98-85cc-40f4-b903-cef86d94087b', { type: 'message.created', outboxId: '65baed88-e75f-4bc5-b9b9-8d69778de366', message: { sequence: 4 } })
    expect(websocketEnvelopeSchema.safeParse(envelope).success).toBe(true)
    expect(envelope.sequence).toBe(4)
  })
})
