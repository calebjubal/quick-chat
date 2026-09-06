import { describe, expect, it } from 'vitest'
import { GROUP_MEMBER_LIMIT, orderDirectPair } from './model.js'

describe('conversation rules', () => {
  it('creates a stable direct pair and enforces the launch group cap', () => {
    expect(orderDirectPair('b', 'a')).toEqual(['a', 'b'])
    expect(GROUP_MEMBER_LIMIT).toBe(256)
  })
})
