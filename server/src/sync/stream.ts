import { Redis } from 'ioredis'
import { env } from '../env.js'

let redis: Redis | undefined
export const getRedis = () => redis ??= new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 })

export async function publishEvent(shardKey: string, event: Record<string, unknown>) {
  const client = getRedis()
  if (client.status === 'wait') await client.connect()
  const shard = Math.abs([...shardKey].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) | 0, 0)) % 32
  return client.xadd(`quickchat:events:${shard}`, 'MAXLEN', '~', 100000, '*', 'event', JSON.stringify(event))
}

export async function closeRedis() { if (redis) await redis.quit() }
