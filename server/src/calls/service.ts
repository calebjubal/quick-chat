import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db/client.js'
import { conversationMembers, conversations, directConversationPairs, users } from '../db/schema.js'
import { canSendTransientEvent } from '../safety/service.js'

export const callSignalPayload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offer'), callId: z.string().uuid(), description: z.object({ type: z.literal('offer'), sdp: z.string().max(65535) }) }),
  z.object({ kind: z.literal('answer'), callId: z.string().uuid(), description: z.object({ type: z.literal('answer'), sdp: z.string().max(65535) }) }),
  z.object({ kind: z.literal('ice'), callId: z.string().uuid(), candidate: z.object({ candidate: z.string().max(4096), sdpMid: z.string().nullable().optional(), sdpMLineIndex: z.number().int().nullable().optional(), usernameFragment: z.string().nullable().optional() }) }),
  z.object({ kind: z.literal('end'), callId: z.string().uuid() }),
])

export async function callRecipient(conversationId: string, senderId: string) {
  if (!(await canSendTransientEvent(conversationId, senderId))) return null
  const [sender] = await db.select({ accountKind: users.accountKind }).from(users).where(eq(users.id, senderId)).limit(1)
  if (sender?.accountKind !== 'registered') return null
  const [pair] = await db.select().from(directConversationPairs).where(eq(directConversationPairs.conversationId, conversationId)).limit(1)
  let recipientId: string | undefined
  if (pair && (pair.firstUserId === senderId || pair.secondUserId === senderId)) recipientId = pair.firstUserId === senderId ? pair.secondUserId : pair.firstUserId
  if (!recipientId) {
    const [conversation] = await db.select({ type: conversations.type }).from(conversations).innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, conversations.id), eq(conversationMembers.userId, senderId))).where(eq(conversations.id, conversationId)).limit(1)
    if (conversation?.type !== 'shared') return null
    const members = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(eq(conversationMembers.conversationId, conversationId)).limit(3)
    if (members.length !== 2) return null
    recipientId = members.find((member) => member.userId !== senderId)?.userId
  }
  if (!recipientId) return null
  const [recipient] = await db.select({ accountKind: users.accountKind }).from(users).where(eq(users.id, recipientId)).limit(1)
  return recipient?.accountKind === 'registered' ? recipientId : null
}

export const callEnvelope = (type: string, conversationId: string, fromUserId: string, payload: z.infer<typeof callSignalPayload>, requestId?: string) => ({
  version: 1 as const,
  type,
  eventId: randomUUID(),
  requestId,
  conversationId,
  occurredAt: new Date().toISOString(),
  payload: { ...payload, fromUserId },
})
