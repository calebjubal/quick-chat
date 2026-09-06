import { getRedis } from '../sync/stream.js'

const PRESENCE_TTL_MS = 70000
export async function touchPresence(userId: string, sessionId: string) {
  const redis = getRedis(); const expires = Date.now() + PRESENCE_TTL_MS
  await redis.zadd(`presence:${userId}`, expires, sessionId); await redis.pexpire(`presence:${userId}`, PRESENCE_TTL_MS * 2)
}
export async function removePresence(userId: string, sessionId: string) { await getRedis().zrem(`presence:${userId}`, sessionId) }
export async function presenceFor(userId: string) { const redis = getRedis(); await redis.zremrangebyscore(`presence:${userId}`, 0, Date.now()); return (await redis.zcard(`presence:${userId}`)) > 0 }
export async function setTyping(conversationId: string, userId: string, active: boolean) { const key = `typing:${conversationId}:${userId}`; if (active) await getRedis().set(key, '1', 'EX', 8); else await getRedis().del(key) }
