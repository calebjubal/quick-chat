import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { attachments } from '../db/schema.js'
import { env } from '../env.js'
import { ALLOWED_MEDIA, safeFileName } from './policy.js'
import { downloadUrl, inspectObject, uploadUrl } from './storage.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)
routes.post('/', async (context) => {
  const input = z.object({ fileName: z.string().min(1).max(255), mimeType: z.string(), byteSize: z.number().int().positive().max(env.MAX_UPLOAD_BYTES) }).parse(await context.req.json())
  const kind = ALLOWED_MEDIA.get(input.mimeType)
  if (!kind) return context.json({ error: { code: 'UNSUPPORTED_MEDIA', message: 'This file type is not supported' } }, 415)
  const id = randomUUID(); const objectKey = `quarantine/${context.get('user').id}/${id}/${safeFileName(input.fileName)}`
  const [attachment] = await db.insert(attachments).values({ id, ownerId: context.get('user').id, objectKey, fileName: safeFileName(input.fileName), mimeType: input.mimeType, kind, byteSize: input.byteSize }).returning()
  return context.json({ attachment, uploadUrl: await uploadUrl(objectKey, input.mimeType, input.byteSize), expiresIn: 600 }, 201)
})
routes.post('/:id/finalize', async (context) => {
  const [attachment] = await db.select().from(attachments).where(eq(attachments.id, context.req.param('id'))).limit(1)
  if (!attachment || attachment.ownerId !== context.get('user').id) return context.json({ error: { code: 'NOT_FOUND', message: 'Upload not found' } }, 404)
  const object = await inspectObject(attachment.objectKey)
  if (object.ContentLength !== attachment.byteSize || object.ContentType !== attachment.mimeType) { await db.update(attachments).set({ status: 'rejected' }).where(eq(attachments.id, attachment.id)); return context.json({ error: { code: 'UPLOAD_MISMATCH', message: 'Uploaded file did not match its declaration' } }, 422) }
  const [updated] = await db.update(attachments).set({ status: 'quarantined' }).where(eq(attachments.id, attachment.id)).returning()
  return context.json({ attachment: updated })
})
routes.get('/:id/download', async (context) => {
  const [attachment] = await db.select().from(attachments).where(eq(attachments.id, context.req.param('id'))).limit(1)
  if (!attachment || attachment.status !== 'ready') return context.json({ error: { code: 'NOT_FOUND', message: 'Attachment is not available' } }, 404)
  return context.json({ url: await downloadUrl(attachment.objectKey), expiresIn: 300 })
})
export default routes
