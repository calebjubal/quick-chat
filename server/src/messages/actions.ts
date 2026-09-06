import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { conversationMembers, eventOutbox, messageDeletions, messages, reactions } from '../db/schema.js'
import { publishEvent } from '../sync/stream.js'
import { DELETE_WINDOW_MS, EDIT_WINDOW_MS, withinWindow } from './action-rules.js'
import { MAX_MESSAGE_LENGTH } from './rules.js'

const actions = new Hono<{ Variables: AppVariables }>()
actions.use('*', requireAuth)

async function accessible(messageId: string, userId: string) {
  const [row] = await db.select({ message: messages }).from(messages).innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId))).where(eq(messages.id, messageId)).limit(1)
  return row?.message
}

actions.patch('/:messageId', async (context) => {
  const userId = context.get('user').id; const message = await accessible(context.req.param('messageId'), userId)
  if (!message) return context.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404)
  if (message.senderId !== userId || !withinWindow(message.createdAt, EDIT_WINDOW_MS) || message.deletedForEveryoneAt) return context.json({ error: { code: 'EDIT_NOT_ALLOWED', message: 'This message can no longer be edited' } }, 409)
  const { body } = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH) }).parse(await context.req.json())
  const [updated] = await db.update(messages).set({ body, editedAt: new Date(), revision: sql`${messages.revision} + 1` }).where(eq(messages.id, message.id)).returning()
  await db.insert(eventOutbox).values({ aggregateId: message.conversationId, type: 'message.updated', payload: { message: updated } })
  publishEvent(message.conversationId, { type: 'message.updated', message: updated }).catch(() => undefined)
  return context.json({ message: updated })
})

actions.delete('/:messageId', async (context) => {
  const userId = context.get('user').id; const message = await accessible(context.req.param('messageId'), userId)
  if (!message) return context.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404)
  const scope = z.enum(['self', 'everyone']).catch('self').parse(context.req.query('scope'))
  if (scope === 'everyone') {
    if (message.senderId !== userId || !withinWindow(message.createdAt, DELETE_WINDOW_MS)) return context.json({ error: { code: 'DELETE_NOT_ALLOWED', message: 'This message can no longer be deleted for everyone' } }, 409)
    await db.update(messages).set({ body: null, deletedForEveryoneAt: new Date(), editedAt: null }).where(eq(messages.id, message.id))
    await db.insert(eventOutbox).values({ aggregateId: message.conversationId, type: 'message.deleted', payload: { messageId: message.id } })
  } else await db.insert(messageDeletions).values({ messageId: message.id, userId }).onConflictDoNothing()
  return context.body(null, 204)
})

actions.put('/:messageId/reaction', async (context) => {
  const userId = context.get('user').id; const message = await accessible(context.req.param('messageId'), userId)
  if (!message) return context.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404)
  const { emoji } = z.object({ emoji: z.string().min(1).max(32) }).parse(await context.req.json())
  await db.insert(reactions).values({ messageId: message.id, userId, emoji }).onConflictDoUpdate({ target: [reactions.messageId, reactions.userId], set: { emoji, createdAt: new Date() } })
  return context.json({ reaction: { messageId: message.id, userId, emoji } })
})

actions.delete('/:messageId/reaction', async (context) => { await db.delete(reactions).where(and(eq(reactions.messageId, context.req.param('messageId')), eq(reactions.userId, context.get('user').id))); return context.body(null, 204) })

export default actions
