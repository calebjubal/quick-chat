import { expect, it } from 'vitest'
import { ALLOWED_MEDIA, safeFileName } from './policy.js'
it('rejects executable media types and sanitizes names', () => { expect(ALLOWED_MEDIA.has('application/x-msdownload')).toBe(false); expect(safeFileName('../bad.exe')).toBe('.._bad.exe') })
