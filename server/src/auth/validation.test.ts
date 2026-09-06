import { describe, expect, it } from 'vitest'
import { guestUpgradeSchema } from './validation.js'

describe('guest account upgrade validation', () => {
  it('requires a valid email and a strong-length password', () => {
    expect(guestUpgradeSchema.safeParse({ email: 'person@example.com', password: 'a-safe-passphrase' }).success).toBe(true)
    expect(guestUpgradeSchema.safeParse({ email: 'not-an-email', password: 'short' }).success).toBe(false)
  })
})
