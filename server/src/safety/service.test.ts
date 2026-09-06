import { describe, expect, it } from 'vitest'
import { reportEvidenceExpiry } from './service.js'

describe('safety retention', () => {
  it('retains report evidence for ninety days', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(reportEvidenceExpiry(now).toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })
})
