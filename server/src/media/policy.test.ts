import { expect, it } from 'vitest'
import { ALLOWED_MEDIA, safeFileName } from './policy.js'
it('rejects executable media types and sanitizes names', () => { expect(ALLOWED_MEDIA.has('application/x-msdownload')).toBe(false); expect(safeFileName('../bad.exe')).toBe('.._bad.exe') })
it('supports common modern office and CSV documents', () => { expect(ALLOWED_MEDIA.get('text/csv')).toBe('document'); expect(ALLOWED_MEDIA.get('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('document') })
