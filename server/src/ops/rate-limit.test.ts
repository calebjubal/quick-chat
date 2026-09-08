import { beforeEach, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../db/client.js', () => ({ db: { execute: mocks.execute } }))
import { consumeRateLimit } from './rate-limit.js'
import { rateLimit } from './middleware.js'
beforeEach(() => vi.clearAllMocks())
it('uses a database counter across instances', async () => {
  mocks.execute.mockResolvedValue([{ count: 3 }])
  expect(await consumeRateLimit('hashed-key')).toBe(3)
  expect(mocks.execute).toHaveBeenCalledTimes(1)
})
it('rejects excess traffic and fails closed when the database is unavailable', async () => {
  const app = new Hono().use('*', rateLimit(2)).get('/', (c) => c.text('ok'))
  mocks.execute.mockResolvedValue([{ count: 3 }])
  expect((await app.request('/')).status).toBe(429)
  mocks.execute.mockRejectedValue(new Error('offline'))
  expect((await app.request('/')).status).toBe(503)
})
