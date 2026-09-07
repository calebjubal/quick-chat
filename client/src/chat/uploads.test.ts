import { describe, expect, it } from 'vitest'
import { normalizedMimeType } from './uploads'

describe('uploads', () => {
  it('normalizes recorder MIME parameters', () => expect(normalizedMimeType(new Blob([], { type: 'audio/webm;codecs=opus' }))).toBe('audio/webm'))
  it('uses a safe fallback when a browser omits MIME metadata', () => expect(normalizedMimeType(new Blob([]))).toBe('application/octet-stream'))
})
