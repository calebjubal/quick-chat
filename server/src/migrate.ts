import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from './env.js'
import { logger } from './ops/logger.js'

const connection = postgres(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL, { max: 1, connect_timeout: 15 })
const db = drizzle(connection)
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  logger.info('Database migrations completed')
} catch (error) {
  logger.error({ error: error instanceof Error ? { name: error.name, message: error.message } : 'Unknown error' }, 'Database migration failed')
  process.exitCode = 1
} finally { await connection.end() }
