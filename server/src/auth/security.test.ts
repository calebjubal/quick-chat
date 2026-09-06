import { describe, expect, it } from 'vitest'
import { createToken, hashPassword, hashToken, normalizeEmail, verifyPassword } from './security.js'

describe('auth security', () => {
  it('normalizes email and hashes opaque values', () => {
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com')
    expect(hashToken('secret')).toHaveLength(64)
    expect(createToken()).not.toContain('=')
  })
  it('uses verifiable password hashes', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true)
    expect(await verifyPassword(hash, 'wrong password')).toBe(false)
  })
})
