import { describe, expect, it } from 'vitest'
import { CREATED_CHAT_LIMIT, messageLimitFor, uploadLimitFor } from './limits.js'

describe('account usage limits', () => {
  it('caps created chats at five while keeping joins uncapped', () => expect(CREATED_CHAT_LIMIT).toBe(5))
  it('gives registered accounts higher daily allowances', () => { expect(messageLimitFor(false)).toBeGreaterThan(messageLimitFor(true)); expect(uploadLimitFor(false)).toBeGreaterThan(uploadLimitFor(true)) })
})
