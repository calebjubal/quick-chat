import { and, eq, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import { blocks, directConversationPairs } from '../db/schema.js'


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
