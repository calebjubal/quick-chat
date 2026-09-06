import { connect } from 'node:net'
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { asc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { attachments } from '../db/schema.js'
import { env } from '../env.js'
import { storage } from './storage.js'

export const matchesDeclaredType = (bytes: Uint8Array, mimeType: string) => {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value)
  if (mimeType === 'image/jpeg') return starts(0xff, 0xd8, 0xff)
  if (mimeType === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  if (mimeType === 'image/gif') return new TextDecoder().decode(bytes.slice(0, 6)).match(/^GIF8[79]a$/) !== null
  if (mimeType === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (mimeType === 'video/mp4') return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp'
  if (mimeType === 'video/webm' || mimeType === 'audio/webm') return starts(0x1a, 0x45, 0xdf, 0xa3)
  if (mimeType === 'audio/ogg') return new TextDecoder().decode(bytes.slice(0, 4)) === 'OggS'
  if (mimeType === 'audio/mpeg') return new TextDecoder().decode(bytes.slice(0, 3)) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  if (mimeType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  if (mimeType.startsWith('application/vnd.openxmlformats-officedocument')) return starts(0x50, 0x4b, 0x03, 0x04)
  if (mimeType === 'text/plain') return !bytes.slice(0, 8192).includes(0)
  return false
}

const scan = (bytes: Uint8Array) => new Promise<boolean>((resolve, reject) => {
  const socket = connect({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT }); const responses: Buffer[] = []; let settled = false
  socket.setTimeout(30_000, () => socket.destroy(new Error('Malware scan timed out')))
  socket.on('connect', () => {
    socket.write('zINSTREAM\0')
    for (let offset = 0; offset < bytes.length; offset += 65536) { const chunk = bytes.slice(offset, offset + 65536); const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk) }
    socket.write(Buffer.alloc(4))
  })
  socket.on('data', (chunk) => { const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk; responses.push(data); if (data.indexOf(0) !== -1) { settled = true; resolve(Buffer.concat(responses).toString('utf8').includes('OK')); socket.end() } })
  socket.on('error', reject)
  socket.on('end', () => { if (!settled) resolve(Buffer.concat(responses).toString('utf8').includes('OK')) })
})

export async function scanQuarantinedAttachments() {
  const queued = await db.select().from(attachments).where(eq(attachments.status, 'quarantined')).orderBy(asc(attachments.createdAt)).limit(20)
  for (const attachment of queued) {
    const object = await storage.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: attachment.objectKey })); const bytes = await object.Body?.transformToByteArray()
    if (!bytes) continue
    const accepted = matchesDeclaredType(bytes, attachment.mimeType) && await scan(bytes)
    if (!accepted) { await storage.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: attachment.objectKey })); await db.update(attachments).set({ status: 'rejected' }).where(eq(attachments.id, attachment.id)); continue }
    const destination = `media/${attachment.ownerId}/${attachment.id}/${attachment.fileName}`
    const copySource = `/${env.S3_BUCKET}/${attachment.objectKey.split('/').map(encodeURIComponent).join('/')}`
    await storage.send(new CopyObjectCommand({ Bucket: env.S3_BUCKET, CopySource: copySource, Key: destination, ContentType: attachment.mimeType, MetadataDirective: 'REPLACE' }))
    await storage.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: attachment.objectKey }))
    await db.update(attachments).set({ objectKey: destination, status: 'ready' }).where(eq(attachments.id, attachment.id))
  }
  return queued.length
}
