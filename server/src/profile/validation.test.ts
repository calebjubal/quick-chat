import { describe, expect, it } from 'vitest'
import { normalizeUsername } from './validation.js'

describe('username validation', () => {
  it('normalizes safe usernames and rejects public-search strings', () => {
    expect(normalizeUsername(' Caleb_7 ')).toBe('caleb_7')
    expect(() => normalizeUsername('Caleb Chandrasekar')).toThrow()
  })
})
