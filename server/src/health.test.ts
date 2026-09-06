import { describe, expect, it } from 'vitest'
import { app } from './app.js'

describe('health endpoints', () => {
  it('reports process liveness without touching dependencies', async () => { const response = await app.request('/health/live'); expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: 'live' }) })
})
