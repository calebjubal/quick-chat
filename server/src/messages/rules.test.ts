import { describe, expect, it } from 'vitest'
import { messageCursor, parseMessageCursor } from './rules.js'
it('round trips opaque message cursors', () => expect(parseMessageCursor(messageCursor(42))).toBe(42))
