import { and, count, eq, gte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { attachments, conversationMembers, messages } from '../db/schema.js'
import { env } from '../env.js'
import { ALLOWED_MEDIA, safeFileName } from './policy.js'
import { downloadUrl, inspectObject, uploadUrl } from './storage.js'
import { uploadLimitFor } from '../usage/limits.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)
routes.post('/', async (context) => {
  const input = z.object({ fileName: z.string().min(1).max(255), mimeType: z.string(), byteSize: z.number().int().positive().max(env.MAX_UPLOAD_BYTES), voice: z.boolean().default(false), durationSeconds: z.number().positive().max(900).optional(), waveform: z.array(z.number().min(0).max(1)).max(200).optional() }).parse(await context.req.json())
  const mimeType = input.mimeType.split(';')[0].trim().toLowerCase(); const mediaKind = ALLOWED_MEDIA.get(mimeType)
  const kind = input.voice && mediaKind === 'audio' ? 'voice' : mediaKind
  if (!kind) return context.json({ error: { code: 'UNSUPPORTED_MEDIA', message: 'This file type is not supported' } }, 415)
  if (input.voice && !input.durationSeconds) return context.json({ error: { code: 'INVALID_VOICE_NOTE', message: 'Voice notes require a duration' } }, 422)
  const actor = context.get('user')
  if (actor.isGuest && !input.voice) return context.json({ error: { code: 'ACCOUNT_REQUIRED', message: 'Create an account to send files' } }, 403)
  const dailyLimit = uploadLimitFor(actor.isGuest)
  const [usage] = await db.select({ count: count() }).from(attachments).where(and(eq(attachments.ownerId, actor.id), gte(attachments.createdAt, new Date(Date.now() - 86400000))))
  if (usage.count >= dailyLimit) return context.json({ error: { code: 'UPLOAD_LIMIT_REACHED', message: `Daily upload limit reached (${dailyLimit})` } }, 429)
  const id = randomUUID(); const objectKey = `quarantine/${context.get('user').id}/${id}/${safeFileName(input.fileName)}`
  const [attachment] = await db.insert(attachments).values({ id, ownerId: actor.id, objectKey, fileName: safeFileName(input.fileName), mimeType, kind, byteSize: input.byteSize, metadata: { durationSeconds: input.durationSeconds, waveform: input.waveform } }).returning()
  return context.json({ attachment, uploadUrl: await uploadUrl(objectKey, mimeType, input.byteSize), expiresIn: 600, quota: { used: usage.count + 1, limit: dailyLimit } }, 201)
})
routes.get('/:id', async (context) => { const [attachment] = await db.select({ id: attachments.id, status: attachments.status, kind: attachments.kind, fileName: attachments.fileName }).from(attachments).where(and(eq(attachments.id, context.req.param('id')), eq(attachments.ownerId, context.get('user').id))).limit(1); return attachment ? context.json({ attachment }) : context.json({ error: { code: 'NOT_FOUND', message: 'Upload not found' } }, 404) })
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
  if (attachment.ownerId !== context.get('user').id) {
    if (!attachment.messageId) return context.json({ error: { code: 'NOT_FOUND', message: 'Attachment is not available' } }, 404)
    const [authorized] = await db.select({ id: messages.id }).from(messages).innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, context.get('user').id))).where(eq(messages.id, attachment.messageId)).limit(1)
    if (!authorized) return context.json({ error: { code: 'NOT_FOUND', message: 'Attachment is not available' } }, 404)
  }
  return context.json({ url: await downloadUrl(attachment.objectKey), expiresIn: 300 })
})
export default routes
