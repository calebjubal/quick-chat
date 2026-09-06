import { and, eq, gt, isNull } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'
import { env } from '../env.js'
import { hashToken } from './security.js'

export type AuthUser = { id: string; email: string; displayName: string; username: string | null; emailVerified: boolean }
export type AppVariables = { user: AuthUser; sessionId: string; requestId: string }
export const sessionCookieName = env.NODE_ENV === 'production' ? '__Host-quickchat_session' : 'quickchat_session'

export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (context, next) => {
  const raw = getCookie(context, sessionCookieName)
  if (!raw) return context.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, 401)
  const [record] = await db.select({ sessionId: sessions.id, userId: users.id, email: users.email, displayName: users.displayName, username: users.username, verifiedAt: users.emailVerifiedAt })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(raw)), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt), isNull(users.deletionScheduledAt))).limit(1)
  if (!record) return context.json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired' } }, 401)
  context.set('user', { id: record.userId, email: record.email, displayName: record.displayName, username: record.username, emailVerified: Boolean(record.verifiedAt) })
  context.set('sessionId', record.sessionId)
  await next()
})
