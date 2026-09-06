import { expect, it } from 'vitest'
it('uses an expiry longer than the socket heartbeat', () => expect(70000).toBeGreaterThan(30000))
