import { Redis } from 'ioredis'
import { EventEmitter } from 'node:events'
import { env } from '../env.js'
import { logger } from '../ops/logger.js'

let redis: Redis | undefined
const localEvents = new EventEmitter()
export const getRedis = () => {
  if (!redis) { redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2000, commandTimeout: 2000 }); redis.on('error', (error) => logger.warn({ error: error.message }, 'Redis connection error')) }
  return redis
}

export async function publishEvent(shardKey: string, event: Record<string, unknown>) {
  localEvents.emit('event', shardKey, event)
  const client = getRedis()
  if (client.status === 'wait') await client.connect()
  const shard = Math.abs([...shardKey].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) | 0, 0)) % 32
  const streamId = await client.xadd(`quickchat:events:${shard}`, 'MAXLEN', '~', 100000, '*', 'event', JSON.stringify(event))
  await client.publish('quickchat:live-events', JSON.stringify({ conversationId: shardKey, event }))
  return streamId
}

export async function startEventRelay(receive: (conversationId: string, event: Record<string, unknown>) => void | Promise<void>) {
  const listener = (conversationId: string, event: Record<string, unknown>) => { void Promise.resolve(receive(conversationId, event)).catch(() => undefined) }
  localEvents.on('event', listener)
  const subscriber = getRedis().duplicate()
  subscriber.on('error', () => undefined)
  await subscriber.subscribe('quickchat:live-events').catch(() => undefined)
  subscriber.on('message', (_channel, raw) => {
    try { const value = JSON.parse(raw) as { conversationId?: unknown; event?: unknown }; if (typeof value.conversationId === 'string' && value.event && typeof value.event === 'object') listener(value.conversationId, value.event as Record<string, unknown>) }
    catch { /* Ignore invalid internal events. */ }
  })
  return async () => { localEvents.off('event', listener); subscriber.disconnect() }
}

export async function closeRedis() { if (redis) await redis.quit() }
