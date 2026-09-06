import { and, eq, lte, or } from 'drizzle-orm'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { db } from '../db/client.js'
import { attachments, blocks, conversationMembers, directConversationPairs, messages, reports } from '../db/schema.js'
import { env } from '../env.js'
import { storage } from '../media/storage.js'

export const reportEvidenceExpiry = (now = new Date()) => new Date(now.getTime() + 90 * 86400000)

export async function isBlockedBetween(firstUserId: string, secondUserId: string) {
  const [row] = await db.select({ blockerId: blocks.blockerId }).from(blocks).where(or(
    and(eq(blocks.blockerId, firstUserId), eq(blocks.blockedId, secondUserId)),
    and(eq(blocks.blockerId, secondUserId), eq(blocks.blockedId, firstUserId)),
  )).limit(1)
  return Boolean(row)
}

export async function directConversationIsBlocked(conversationId: string) {
  const [pair] = await db.select().from(directConversationPairs).where(eq(directConversationPairs.conversationId, conversationId)).limit(1)
  return pair ? isBlockedBetween(pair.firstUserId, pair.secondUserId) : false
}

export async function canSendTransientEvent(conversationId: string, userId: string) {
  const [membership] = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId))).limit(1)
  return Boolean(membership) && !(await directConversationIsBlocked(conversationId))
}

export async function scrubExpiredMessages(now = new Date()) {
  const expired = await db.select({ id: messages.id }).from(messages).where(lte(messages.expiresAt, now)).limit(500)
  if (!expired.length) return 0
  for (const message of expired) {
    const media = await db.select().from(attachments).where(eq(attachments.messageId, message.id))
    await Promise.allSettled(media.map((attachment) => storage.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: attachment.objectKey }))))
    await db.transaction(async (tx) => {
      await tx.delete(attachments).where(eq(attachments.messageId, message.id))
      await tx.update(messages).set({ body: null, deletedForEveryoneAt: now, expiresAt: null }).where(eq(messages.id, message.id))
    })
  }
  return expired.length
}

export async function scrubExpiredReportEvidence(now = new Date()) {
  const scrubbed = await db.update(reports).set({ evidence: {} }).where(lte(reports.evidenceExpiresAt, now)).returning({ id: reports.id })
  return scrubbed.length
}
