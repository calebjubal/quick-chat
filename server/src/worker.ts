import { and, asc, eq, isNull, lt } from 'drizzle-orm'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { db, closeDatabase } from './db/client.js'
import { attachments, eventOutbox, users } from './db/schema.js'
import { env } from './env.js'
import { storage } from './media/storage.js'
import { logger } from './ops/logger.js'
import { shutdownTelemetry } from './ops/instrumentation.js'
import { scrubExpiredMessages, scrubExpiredReportEvidence } from './safety/service.js'
import { closeRedis, publishEvent } from './sync/stream.js'
import { scanQuarantinedAttachments } from './media/scanner.js'

let stopping = false
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function publishOutbox() {
  const records = await db.select().from(eventOutbox).where(isNull(eventOutbox.publishedAt)).orderBy(asc(eventOutbox.createdAt)).limit(100)
  for (const record of records) {
    await publishEvent(record.aggregateId, { id: record.id, type: record.type, payload: record.payload, occurredAt: record.createdAt.toISOString() })
    await db.update(eventOutbox).set({ publishedAt: new Date() }).where(and(eq(eventOutbox.id, record.id), isNull(eventOutbox.publishedAt)))
  }
  return records.length
}

async function cleanupAbandonedUploads() {
  const stale = await db.select().from(attachments).where(and(eq(attachments.status, 'pending'), lt(attachments.createdAt, new Date(Date.now() - 24 * 3600000)))).limit(100)
  await Promise.allSettled(stale.map((attachment) => storage.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: attachment.objectKey }))))
  for (const attachment of stale) await db.delete(attachments).where(eq(attachments.id, attachment.id))
  return stale.length
}

async function deleteScheduledAccounts() {
  const deleted = await db.delete(users).where(lt(users.deletionScheduledAt, new Date())).returning({ id: users.id })
  return deleted.length
}

async function work() {
  const [published, expiredMessages, expiredEvidence, abandonedUploads, deletedAccounts, scannedUploads] = await Promise.all([publishOutbox(), scrubExpiredMessages(), scrubExpiredReportEvidence(), cleanupAbandonedUploads(), deleteScheduledAccounts(), scanQuarantinedAttachments()])
  if (published || expiredMessages || expiredEvidence || abandonedUploads || deletedAccounts || scannedUploads) logger.info({ published, expiredMessages, expiredEvidence, abandonedUploads, deletedAccounts, scannedUploads }, 'worker cycle completed')
}

async function run() {
  logger.info('Quickchat worker started')
  while (!stopping) { try { await work() } catch (error) { logger.error({ error: error instanceof Error ? { name: error.name, message: error.message } : 'Unknown error' }, 'worker cycle failed') } await pause(env.WORKER_INTERVAL_MS) }
}

async function shutdown() { stopping = true; await Promise.allSettled([closeRedis(), closeDatabase(), shutdownTelemetry()]) }
process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown())
await run()
