import { and, desc, eq, isNull, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { type AppVariables, requireAuth, sessionCookieName } from '../auth/middleware.js'
import { hashPassword, verifyPassword } from '../auth/security.js'
import { db } from '../db/client.js'
import { credentials, eventOutbox, sessions, users } from '../db/schema.js'
import { accountDeletionDate, describeDevice } from './service.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)

routes.get('/me/settings', async (context) => {
  const [settings] = await db.select({ theme: users.theme, readReceiptsEnabled: users.readReceiptsEnabled, lastSeenVisibility: users.lastSeenVisibility }).from(users).where(eq(users.id, context.get('user').id)).limit(1)
  return context.json({ settings })
})
routes.patch('/me/settings', async (context) => {
  const input = z.object({ theme: z.enum(['system', 'light', 'dark']).optional(), readReceiptsEnabled: z.boolean().optional(), lastSeenVisibility: z.enum(['everyone', 'contacts', 'nobody']).optional() }).parse(await context.req.json())
  const [settings] = await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, context.get('user').id)).returning({ theme: users.theme, readReceiptsEnabled: users.readReceiptsEnabled, lastSeenVisibility: users.lastSeenVisibility })
  return context.json({ settings })
})

routes.get('/sessions', async (context) => {
  const currentId = context.get('sessionId')
  const rows = await db.select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt }).from(sessions).where(and(eq(sessions.userId, context.get('user').id), isNull(sessions.revokedAt))).orderBy(desc(sessions.lastSeenAt))
  return context.json({ sessions: rows.map(({ userAgent, ...session }) => ({ ...session, current: session.id === currentId, device: describeDevice(userAgent) })) })
})
routes.delete('/sessions/:id', async (context) => {
  const sessionId = z.string().uuid().parse(context.req.param('id'))
  const [revoked] = await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, context.get('user').id))).returning({ id: sessions.id })
  if (!revoked) return context.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404)
  if (sessionId === context.get('sessionId')) deleteCookie(context, sessionCookieName, { path: '/' })
  return context.body(null, 204)
})

routes.post('/password', async (context) => {
  const input = z.object({ currentPassword: z.string().max(128), newPassword: z.string().min(12).max(128) }).parse(await context.req.json())
  const userId = context.get('user').id
  const [credential] = await db.select().from(credentials).where(eq(credentials.userId, userId)).limit(1)
  if (!credential || !(await verifyPassword(credential.passwordHash, input.currentPassword))) return context.json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } }, 403)
  await db.transaction(async (tx) => {
    await tx.update(credentials).set({ passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() }).where(eq(credentials.userId, userId))
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), ne(sessions.id, context.get('sessionId')), isNull(sessions.revokedAt)))
  })
  return context.json({ changed: true })
})

routes.post('/export', async (context) => {
  const userId = context.get('user').id
  const [request] = await db.insert(eventOutbox).values({ aggregateId: userId, type: 'account.export.requested', payload: { userId, requestedAt: new Date().toISOString() } }).returning({ id: eventOutbox.id, createdAt: eventOutbox.createdAt })
  return context.json({ request }, 202)
})

routes.delete('/account', async (context) => {
  const input = z.object({ password: z.string().max(128) }).parse(await context.req.json()); const userId = context.get('user').id
  const [credential] = await db.select().from(credentials).where(eq(credentials.userId, userId)).limit(1)
  if (!credential || !(await verifyPassword(credential.passwordHash, input.password))) return context.json({ error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' } }, 403)
  const deletionScheduledAt = accountDeletionDate()
  await db.transaction(async (tx) => { await tx.update(users).set({ deletionScheduledAt, updatedAt: new Date() }).where(eq(users.id, userId)); await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt))) })
  deleteCookie(context, sessionCookieName, { path: '/' })
  return context.json({ deletionScheduledAt })
})

export default routes
