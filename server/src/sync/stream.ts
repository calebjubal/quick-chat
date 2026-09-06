import { Redis } from 'ioredis'
import { env } from '../env.js'
import { logger } from '../ops/logger.js'

let redis: Redis | undefined
export const getRedis = () => {
  if (!redis) { redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }); redis.on('error', (error) => logger.warn({ error: error.message }, 'Redis connection error')) }
  return redis
}

export async function publishEvent(shardKey: string, event: Record<string, unknown>) {
  const client = getRedis()
  if (client.status === 'wait') await client.connect()
  const shard = Math.abs([...shardKey].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) | 0, 0)) % 32
  return client.xadd(`quickchat:events:${shard}`, 'MAXLEN', '~', 100000, '*', 'event', JSON.stringify(event))
}

export async function closeRedis() { if (redis) await redis.quit() }
