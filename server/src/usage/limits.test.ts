import { expect, it } from 'vitest'
import { CREATED_CHAT_LIMIT, messageLimitFor } from './limits.js'
it('keeps the five-chat and guest/account text limits', () => {
  expect(CREATED_CHAT_LIMIT).toBe(5)
  expect(messageLimitFor(true)).toBe(50)
  expect(messageLimitFor(false)).toBe(1000)
})
