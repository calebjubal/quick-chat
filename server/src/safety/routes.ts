import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { blocks, conversationMembers, messages, reports, users } from '../db/schema.js'
import { reportEvidenceExpiry } from './service.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)

routes.get('/blocks', async (context) => {
  const rows = await db.select({ user: { id: users.id, username: users.username, displayName: users.displayName }, createdAt: blocks.createdAt }).from(blocks).innerJoin(users, eq(users.id, blocks.blockedId)).where(eq(blocks.blockerId, context.get('user').id)).orderBy(desc(blocks.createdAt))
  return context.json({ blocks: rows })
})

routes.post('/blocks/:userId', async (context) => {
  const blockerId = context.get('user').id; const blockedId = z.string().uuid().parse(context.req.param('userId'))
  if (blockerId === blockedId) return context.json({ error: { code: 'INVALID_TARGET', message: 'You cannot block yourself' } }, 400)
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, blockedId)).limit(1)
  if (!target) return context.json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, 404)
  await db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing()
  return context.json({ blocked: true }, 201)
})

routes.delete('/blocks/:userId', async (context) => {
  await db.delete(blocks).where(and(eq(blocks.blockerId, context.get('user').id), eq(blocks.blockedId, z.string().uuid().parse(context.req.param('userId')))))
  return context.body(null, 204)
})

routes.post('/reports', async (context) => {
  const input = z.object({ reportedUserId: z.string().uuid().optional(), conversationId: z.string().uuid().optional(), reason: z.string().trim().min(3).max(80), detail: z.string().trim().max(2000).optional() }).refine((value) => value.reportedUserId || value.conversationId, 'A user or conversation is required').parse(await context.req.json())
  const reporterId = context.get('user').id
  if (input.conversationId) {
    const [member] = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, input.conversationId), eq(conversationMembers.userId, reporterId))).limit(1)
    if (!member) return context.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404)
  }
  const evidenceMessages = input.conversationId ? await db.select({ id: messages.id, senderId: messages.senderId, body: messages.body, createdAt: messages.createdAt }).from(messages).where(eq(messages.conversationId, input.conversationId)).orderBy(desc(messages.sequence)).limit(20) : []
  const [report] = await db.insert(reports).values({ ...input, reporterId, evidence: { messages: evidenceMessages }, evidenceExpiresAt: reportEvidenceExpiry() }).returning({ id: reports.id, status: reports.status, createdAt: reports.createdAt })
  return context.json({ report }, 201)
})

export default routes
