import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'

// Shared atomic counters; no process-local fallback that can bypass auth limits.
export async function consumeRateLimit(key: string): Promise<number> {
  const rows = await db.execute(sql`
    WITH cleanup AS (
      DELETE FROM request_limits WHERE key IN (
        SELECT key FROM request_limits WHERE expires_at < now() LIMIT 100
      )
    )
    INSERT INTO request_limits (key, count, expires_at)
    VALUES (${key}, 1, now() + interval '2 minutes')
    ON CONFLICT (key) DO UPDATE SET count = request_limits.count + 1
    RETURNING count
  `)
  return Number(rows[0].count)
}
