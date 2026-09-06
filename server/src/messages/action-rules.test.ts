import { expect, it } from 'vitest'
import { EDIT_WINDOW_MS, withinWindow } from './action-rules.js'
it('enforces message action windows', () => expect(withinWindow(new Date(0), EDIT_WINDOW_MS, new Date(EDIT_WINDOW_MS + 1))).toBe(false))
