import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], consumed: false, updates: [] as unknown[], mail: vi.fn(), verify: vi.fn().mockResolvedValue(true) }))
vi.mock('../db/client.js', () => {
  const update = (table: unknown) => {
    mocks.updates.push(table)
    return { set: () => ({ where: () => ({ returning: async () => {
      if (mocks.consumed) return []
      mocks.consumed = true
      return [{ userId: 'user-id' }]
    } }) }) }
  }
  const db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => mocks.rows }) }) }) }),
    update,
    transaction: async (fn: (tx: { update: typeof update }) => Promise<unknown>) => fn({ update }),
  }
  return { db }
})
vi.mock('./mailer.js', () => ({ requireMailConfiguration: () => mocks.mail(), sendAccountEmail: vi.fn() }))
vi.mock('./security.js', () => ({ hashToken: (s: string) => s, normalizeEmail: (s: string) => s.toLowerCase(), hashPassword: async () => 'hashed', verifyPassword: mocks.verify, createToken: () => 'token' }))
import auth from './routes.js'
const app = new Hono().route('/auth', auth)
const post = (path: string, body: unknown) => app.request(`/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => { mocks.rows = []; mocks.consumed = false; mocks.updates = []; vi.clearAllMocks() })
describe('account security routes', () => {
  it('rejects deleted accounts before creating a session', async () => {
    mocks.rows = [{ user: { deletionScheduledAt: new Date(), emailVerifiedAt: new Date() }, passwordHash: 'hash' }]
    expect((await post('login', { email: 'person@example.com', password: 'valid-password' })).status).toBe(401)
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it('rejects unverified accounts', async () => {
    mocks.rows = [{ user: { deletionScheduledAt: null, emailVerifiedAt: null }, passwordHash: 'hash' }]
    expect((await post('login', { email: 'person@example.com', password: 'valid-password' })).status).toBe(403)
  })
  it.each(['verify', 'password/reset'])('consumes %s tokens atomically before changing account data', async (path) => {
    const body = { token: 'single-use-token-at-least-20', password: 'strong-new-password' }
    expect((await post(path, body)).status).toBe(200)
    const changes = mocks.updates.length
    expect((await post(path, body)).status).toBe(400)
    expect(mocks.updates.length).toBe(changes + 1)
  })
})
