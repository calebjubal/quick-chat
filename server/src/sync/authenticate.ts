import { and, eq, gt, isNull } from 'drizzle-orm'
import type { IncomingMessage } from 'node:http'
import { sessions, users } from '../db/schema.js'
import { db } from '../db/client.js'
import { sessionCookieName } from '../auth/middleware.js'
import { hashToken } from '../auth/security.js'
import { env } from '../env.js'

export async function authenticateUpgrade(request: IncomingMessage) {
  if (!request.headers.origin || !env.ALLOWED_ORIGINS.split(',').includes(request.headers.origin)) return null
  const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter((parts) => parts.length === 2) as [string, string][])
  const token = cookies[sessionCookieName]
  if (!token) return null
  const [record] = await db.select({ userId: users.id, sessionId: sessions.id }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt), isNull(users.deletionScheduledAt))).limit(1)
  return record ?? null
}
