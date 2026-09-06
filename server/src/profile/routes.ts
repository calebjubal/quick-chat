import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client.js'
import { invites, users } from '../db/schema.js'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { createToken, hashToken } from '../auth/security.js'
import { normalizeUsername, usernameSchema } from './validation.js'

const profile = new Hono<{ Variables: AppVariables }>()
profile.use('*', requireAuth)

profile.get('/me', async (context) => {
  const [user] = await db.select({ id: users.id, email: users.email, displayName: users.displayName, username: users.username, about: users.about, avatarKey: users.avatarKey, theme: users.theme }).from(users).where(eq(users.id, context.get('user').id)).limit(1)
  return context.json({ user })
})

profile.patch('/me', async (context) => {
  const input = z.object({ displayName: z.string().trim().min(1).max(80).optional(), username: usernameSchema.optional(), about: z.string().trim().max(160).nullable().optional() }).parse(await context.req.json())
  const patch = { ...input, ...(input.username ? { username: input.username, usernameNormalized: normalizeUsername(input.username) } : {}) }
  try {
    const [user] = await db.update(users).set(patch).where(eq(users.id, context.get('user').id)).returning({ id: users.id, displayName: users.displayName, username: users.username, about: users.about, avatarKey: users.avatarKey })
    return context.json({ user })
  } catch { return context.json({ error: { code: 'USERNAME_TAKEN', message: 'That username is unavailable' } }, 409) }
})

profile.get('/users/lookup', async (context) => {
  const username = normalizeUsername(context.req.query('username') ?? '')
  const [user] = await db.select({ id: users.id, displayName: users.displayName, username: users.username, about: users.about, avatarKey: users.avatarKey }).from(users).where(and(eq(users.usernameNormalized, username), isNotNull(users.emailVerifiedAt), isNull(users.deletionScheduledAt))).limit(1)
  return user ? context.json({ user }) : context.json({ error: { code: 'USER_NOT_FOUND', message: 'No user has that exact username' } }, 404)
})

profile.post('/invites', async (context) => {
  const token = createToken()
  const [invite] = await db.insert(invites).values({ createdBy: context.get('user').id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning({ id: invites.id, expiresAt: invites.expiresAt })
  return context.json({ invite: { ...invite, token } }, 201)
})

profile.get('/invites/:token', async (context) => {
  const [invite] = await db.select({ id: invites.id, expiresAt: invites.expiresAt, creator: { id: users.id, displayName: users.displayName, username: users.username, avatarKey: users.avatarKey } }).from(invites).innerJoin(users, eq(users.id, invites.createdBy)).where(and(eq(invites.tokenHash, hashToken(context.req.param('token'))), isNull(invites.revokedAt))).limit(1)
  if (!invite || invite.expiresAt <= new Date()) return context.json({ error: { code: 'INVITE_EXPIRED', message: 'This invite is invalid or expired' } }, 404)
  return context.json({ invite })
})

export default profile
