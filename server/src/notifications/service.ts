import { createHash } from 'node:crypto'
import { and, eq, isNull, lt, ne, or } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '../db/client.js'
import { conversationMembers, pushSubscriptions, users } from '../db/schema.js'
import { env } from '../env.js'
import { getRedis } from '../sync/stream.js'

export const endpointHash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex')
export const notificationPayload = (senderName: string, conversationId: string) => ({
  title: senderName,
  body: 'New message',
  conversationId,
  url: `/?conversation=${conversationId}`,
  tag: `conversation:${conversationId}`,
})

const pushConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
if (pushConfigured) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)

export async function setNotificationFocus(userId: string, conversationId: string | null) {
  const key = `notification-focus:${userId}`
  if (conversationId) await getRedis().set(key, conversationId, 'EX', 90)
  else await getRedis().del(key)
}

async function isFocused(userId: string, conversationId: string) {
  return getRedis().get(`notification-focus:${userId}`).then((value) => value === conversationId).catch(() => false)
}

export async function notifyConversation(conversationId: string, senderId: string, senderName: string) {
  if (!pushConfigured) return
  const recipients = await db.select({ subscription: pushSubscriptions, userId: conversationMembers.userId })
    .from(conversationMembers)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, conversationMembers.userId))
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(and(
      eq(conversationMembers.conversationId, conversationId),
      ne(conversationMembers.userId, senderId),
      isNull(users.deletionScheduledAt),
      or(isNull(conversationMembers.mutedUntil), lt(conversationMembers.mutedUntil, new Date())),
    ))

  const payload = JSON.stringify(notificationPayload(senderName, conversationId))
  await Promise.allSettled(recipients.map(async ({ subscription, userId }) => {
    if (await isFocused(userId, conversationId)) return
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 60, urgency: 'high' })
    } catch (error) {
      const statusCode = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0
      if (statusCode === 404 || statusCode === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id))
    }
  }))
}
