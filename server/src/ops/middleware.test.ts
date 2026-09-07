import { describe, expect, it } from 'vitest'
import { protectOrigin, rateLimitKey, safeRequestId } from './middleware.js'
import { Hono } from 'hono'

describe('operational middleware', () => {
  it('accepts safe correlation IDs and replaces unsafe values', () => { expect(safeRequestId('request_123')).toBe('request_123'); expect(safeRequestId('<script>')).toMatch(/^[0-9a-f-]{36}$/) })
  it('does not expose client addresses in rate-limit keys', () => { const key = rateLimitKey('203.0.113.10', 123); expect(key).toHaveLength(64); expect(key).not.toContain('203.0.113.10') })
  it('rejects absent and untrusted origins on mutations, including login', async () => {
    const app = new Hono().use('*', protectOrigin).post('/login', (c) => c.json({ ok: true }))
    for (const origin of [undefined, 'null', 'https://attacker.example']) {
      const result = await app.request('/login', { method: 'POST', headers: origin ? { origin } : {} })
      expect(result.status).toBe(403)
    }
    expect((await app.request('/login', { method: 'POST', headers: { origin: 'http://localhost:5173' } })).status).toBe(200)
  })
})
