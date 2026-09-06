import { describe, expect, it } from 'vitest'
import { accountDeletionDate, describeDevice } from './service.js'

describe('account settings', () => {
  it('schedules deletion thirty days ahead', () => expect(accountDeletionDate(new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-31T00:00:00.000Z'))
  it('uses privacy-safe device labels', () => expect(describeDevice('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows device'))
})
