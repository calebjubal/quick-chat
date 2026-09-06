import { describe, expect, it } from 'vitest'
import { matchesDeclaredType } from './scanner.js'

describe('attachment magic-byte validation', () => {
  it('accepts declared PNG signatures', () => expect(matchesDeclaredType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png')).toBe(true))
  it('rejects executable bytes disguised as an image', () => expect(matchesDeclaredType(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]), 'image/png')).toBe(false))
})
