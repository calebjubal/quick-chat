import { and, desc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { conversationMembers, conversations, directConversationPairs, users } from '../db/schema.js'
import { GROUP_MEMBER_LIMIT, orderDirectPair } from './model.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)

async function membership(conversationId: string, userId: string) {
  const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId))).limit(1)
  return member
}

routes.get('/', async (context) => {
  const userId = context.get('user').id
  const rows = await db.select({ conversation: conversations, membership: conversationMembers }).from(conversationMembers).innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId)).where(eq(conversationMembers.userId, userId)).orderBy(desc(conversations.updatedAt)).limit(50)
  const enriched = await Promise.all(rows.map(async (row) => ({ ...row, participants: await db.select({ id: users.id, displayName: users.displayName, username: users.username, avatarKey: users.avatarKey }).from(conversationMembers).innerJoin(users, eq(users.id, conversationMembers.userId)).where(and(eq(conversationMembers.conversationId, row.conversation.id), ne(users.id, userId))).limit(4) })))
  return context.json({ conversations: enriched, nextCursor: null })
})

routes.post('/direct', async (context) => {
  const { userId: targetId } = z.object({ userId: z.string().uuid() }).parse(await context.req.json())
  const actorId = context.get('user').id
  if (actorId === targetId) return context.json({ error: { code: 'INVALID_TARGET', message: 'You cannot message yourself' } }, 400)
  const [firstUserId, secondUserId] = orderDirectPair(actorId, targetId)
  const [existing] = await db.select({ conversation: conversations }).from(directConversationPairs).innerJoin(conversations, eq(conversations.id, directConversationPairs.conversationId)).where(and(eq(directConversationPairs.firstUserId, firstUserId), eq(directConversationPairs.secondUserId, secondUserId))).limit(1)
  if (existing) return context.json(existing)
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1)
  if (!target) return context.json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, 404)
  const conversation = await db.transaction(async (tx) => {
    const [created] = await tx.insert(conversations).values({ type: 'direct', createdBy: actorId }).returning()
    await tx.insert(directConversationPairs).values({ conversationId: created.id, firstUserId, secondUserId })
    await tx.insert(conversationMembers).values([{ conversationId: created.id, userId: actorId, role: 'member' }, { conversationId: created.id, userId: targetId, role: 'member' }])
    return created
  })
  return context.json({ conversation }, 201)
})

routes.post('/groups', async (context) => {
  const input = z.object({ title: z.string().trim().min(1).max(120), memberIds: z.array(z.string().uuid()).max(GROUP_MEMBER_LIMIT - 1).default([]) }).parse(await context.req.json())
  const ownerId = context.get('user').id
  const memberIds = [...new Set(input.memberIds.filter((id) => id !== ownerId))]
  const conversation = await db.transaction(async (tx) => {
    const [created] = await tx.insert(conversations).values({ type: 'group', title: input.title, createdBy: ownerId }).returning()
    await tx.insert(conversationMembers).values([{ conversationId: created.id, userId: ownerId, role: 'owner' }, ...memberIds.map((userId) => ({ conversationId: created.id, userId, role: 'member' as const }))])
    return created
  })
  return context.json({ conversation }, 201)
})

routes.get('/:id', async (context) => {
  const member = await membership(context.req.param('id'), context.get('user').id)
  if (!member) return context.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404)
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, member.conversationId)).limit(1)
  const members = await db.select({ membership: conversationMembers, user: { id: users.id, displayName: users.displayName, username: users.username, avatarKey: users.avatarKey } }).from(conversationMembers).innerJoin(users, eq(users.id, conversationMembers.userId)).where(eq(conversationMembers.conversationId, member.conversationId)).limit(GROUP_MEMBER_LIMIT)
  return context.json({ conversation, members })
})

routes.patch('/:id', async (context) => {
  const actor = await membership(context.req.param('id'), context.get('user').id)
  if (!actor || !['owner', 'admin'].includes(actor.role)) return context.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403)
  const input = z.object({ title: z.string().trim().min(1).max(120).optional(), avatarKey: z.string().max(1024).nullable().optional(), disappearingSeconds: z.union([z.literal(86400), z.literal(604800), z.literal(7776000), z.null()]).optional() }).parse(await context.req.json())
  const [conversation] = await db.update(conversations).set({ ...input, updatedAt: new Date() }).where(eq(conversations.id, actor.conversationId)).returning()
  return context.json({ conversation })
})

routes.patch('/:id/inbox', async (context) => {
  const actor = await membership(context.req.param('id'), context.get('user').id)
  if (!actor) return context.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404)
  const input = z.object({ pinned: z.boolean().optional(), archived: z.boolean().optional(), mutedUntil: z.string().datetime().nullable().optional() }).parse(await context.req.json())
  await db.update(conversationMembers).set({ ...(input.pinned !== undefined ? { pinnedAt: input.pinned ? new Date() : null } : {}), ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}), ...(input.mutedUntil !== undefined ? { mutedUntil: input.mutedUntil ? new Date(input.mutedUntil) : null } : {}) }).where(and(eq(conversationMembers.conversationId, actor.conversationId), eq(conversationMembers.userId, actor.userId)))
  return context.json({ updated: true })
})

routes.post('/:id/members', async (context) => {
  const actor = await membership(context.req.param('id'), context.get('user').id)
  if (!actor || !['owner', 'admin'].includes(actor.role)) return context.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403)
  const { userIds } = z.object({ userIds: z.array(z.string().uuid()).min(1).max(GROUP_MEMBER_LIMIT) }).parse(await context.req.json())
  const existing = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(eq(conversationMembers.conversationId, actor.conversationId))
  const add = [...new Set(userIds)].filter((id) => !existing.some((item) => item.userId === id))
  if (existing.length + add.length > GROUP_MEMBER_LIMIT) return context.json({ error: { code: 'GROUP_FULL', message: `Groups support up to ${GROUP_MEMBER_LIMIT} members` } }, 409)
  if (add.length) await db.insert(conversationMembers).values(add.map((userId) => ({ conversationId: actor.conversationId, userId })))
  return context.json({ added: add.length })
})

routes.patch('/:id/members/:userId', async (context) => {
  const actor = await membership(context.req.param('id'), context.get('user').id)
  if (!actor || actor.role !== 'owner') return context.json({ error: { code: 'FORBIDDEN', message: 'Owner access required' } }, 403)
  const { role } = z.object({ role: z.enum(['admin', 'member']) }).parse(await context.req.json())
  await db.update(conversationMembers).set({ role }).where(and(eq(conversationMembers.conversationId, actor.conversationId), eq(conversationMembers.userId, context.req.param('userId'))))
  return context.json({ updated: true })
})

routes.delete('/:id/members/:userId', async (context) => {
  const actor = await membership(context.req.param('id'), context.get('user').id); const targetId = context.req.param('userId')
  if (!actor || (targetId !== actor.userId && !['owner', 'admin'].includes(actor.role))) return context.json({ error: { code: 'FORBIDDEN', message: 'Not allowed' } }, 403)
  await db.delete(conversationMembers).where(and(eq(conversationMembers.conversationId, actor.conversationId), eq(conversationMembers.userId, targetId)))
  return context.body(null, 204)
})

export default routes
