import { describe, expect, it } from 'vitest'
import { rateLimitKey, safeRequestId } from './middleware.js'

describe('operational middleware', () => {
  it('accepts safe correlation IDs and replaces unsafe values', () => { expect(safeRequestId('request_123')).toBe('request_123'); expect(safeRequestId('<script>')).toMatch(/^[0-9a-f-]{36}$/) })
  it('does not expose client addresses in rate-limit keys', () => { const key = rateLimitKey('203.0.113.10', 123); expect(key).toHaveLength(64); expect(key).not.toContain('203.0.113.10') })
})
