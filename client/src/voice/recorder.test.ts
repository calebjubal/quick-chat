import { expect, it } from 'vitest'
import { formatVoiceDuration, MAX_VOICE_SECONDS } from './recorder'
it('formats voice duration and caps recordings at 15 minutes', () => { expect(formatVoiceDuration(65)).toBe('1:05'); expect(MAX_VOICE_SECONDS).toBe(900) })
