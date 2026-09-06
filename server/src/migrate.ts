import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { closeDatabase, db } from './db/client.js'
import { logger } from './ops/logger.js'

try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  logger.info('Database migrations completed')
} catch (error) {
  logger.error({ error: error instanceof Error ? { name: error.name, message: error.message } : 'Unknown error' }, 'Database migration failed')
  process.exitCode = 1
} finally { await closeDatabase() }
