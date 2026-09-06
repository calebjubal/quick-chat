import { and, desc, eq, ilike, lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { conversationMembers, conversations, eventOutbox, messages } from '../db/schema.js'
import { publishEvent } from '../sync/stream.js'
import { MAX_MESSAGE_LENGTH, messageCursor, parseMessageCursor } from './rules.js'
import { notifyConversation } from '../notifications/service.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)

async function isMember(conversationId: string, userId: string) {
  const [row] = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId))).limit(1)
  return Boolean(row)
}

routes.get('/conversations/:conversationId/messages', async (context) => {
  const conversationId = context.req.param('conversationId'); const userId = context.get('user').id
  if (!(await isMember(conversationId, userId))) return context.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404)
  const limit = Math.min(Number(context.req.query('limit') ?? 50), 100); const before = parseMessageCursor(context.req.query('cursor'))
  const rows = await db.select().from(messages).where(and(eq(messages.conversationId, conversationId), lt(messages.sequence, before))).orderBy(desc(messages.sequence)).limit(limit + 1)
  const hasMore = rows.length > limit; const page = rows.slice(0, limit)
  return context.json({ messages: page.reverse(), nextCursor: hasMore ? messageCursor(page[page.length - 1].sequence) : null })
})

routes.post('/conversations/:conversationId/messages', async (context) => {
  const conversationId = context.req.param('conversationId'); const senderId = context.get('user').id
  if (!(await isMember(conversationId, senderId))) return context.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404)
  const input = z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), replyToId: z.string().uuid().optional(), forwarded: z.boolean().default(false) }).parse(await context.req.json())
  const existing = await db.select().from(messages).where(eq(messages.id, input.id)).limit(1)
  if (existing[0]) return context.json({ message: existing[0], deduplicated: true })
  const event = await db.transaction(async (tx) => {
    const [counter] = await tx.update(conversations).set({ nextSequence: sql`${conversations.nextSequence} + 1`, updatedAt: new Date() }).where(eq(conversations.id, conversationId)).returning({ sequence: conversations.nextSequence, disappearingSeconds: conversations.disappearingSeconds })
    const sequence = counter.sequence - 1
    const [message] = await tx.insert(messages).values({ ...input, conversationId, senderId, sequence, expiresAt: counter.disappearingSeconds ? new Date(Date.now() + counter.disappearingSeconds * 1000) : null }).returning()
    const [outbox] = await tx.insert(eventOutbox).values({ aggregateId: conversationId, type: 'message.created', payload: { message } }).returning()
    return { message, outboxId: outbox.id }
  })
  publishEvent(conversationId, { type: 'message.created', ...event }).catch(() => undefined)
  notifyConversation(conversationId, senderId, context.get('user').displayName).catch(() => undefined)
  return context.json({ message: event.message }, 201)
})

routes.patch('/conversations/:conversationId/receipts', async (context) => {
  const conversationId = context.req.param('conversationId'); const userId = context.get('user').id
  const input = z.object({ deliveredSequence: z.number().int().nonnegative().optional(), readSequence: z.number().int().nonnegative().optional() }).parse(await context.req.json())
  if (!(await isMember(conversationId, userId))) return context.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404)
  await db.update(conversationMembers).set({ ...(input.deliveredSequence !== undefined ? { lastDeliveredSequence: input.deliveredSequence } : {}), ...(input.readSequence !== undefined ? { lastReadSequence: input.readSequence } : {}) }).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
  return context.json({ updated: true })
})

routes.get('/messages/search', async (context) => {
  const query = z.string().trim().min(2).max(100).parse(context.req.query('q'))
  const userId = context.get('user').id
  const rows = await db.select({ message: messages }).from(messages).innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId))).where(ilike(messages.body, `%${query.replace(/[%_]/g, '\\$&')}%`)).orderBy(desc(messages.createdAt)).limit(50)
  return context.json({ messages: rows.map((row) => row.message), nextCursor: null })
})

export default routes
