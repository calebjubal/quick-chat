import { describe, expect, it } from 'vitest'
import { callEnvelope, callSignalPayload } from './service.js'

describe('call signaling', () => {
  it('accepts bounded WebRTC offers', () => expect(callSignalPayload.safeParse({ kind: 'offer', callId: '8da2a7a0-037a-4740-a7ee-ad0df1484c2f', description: { type: 'offer', sdp: 'v=0' } }).success).toBe(true))
  it('creates versioned private envelopes', () => expect(callEnvelope('call.end', '8da2a7a0-037a-4740-a7ee-ad0df1484c2f', 'dc632b14-dd99-4fc4-92b9-738977300783', { kind: 'end', callId: 'f8e10fa3-8ab5-4364-8648-e5f0c564fda7' })).toMatchObject({ version: 1, type: 'call.end' }))
})
