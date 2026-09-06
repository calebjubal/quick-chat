import { clientSocketEventSchema } from '@quickchat/contracts'
import { serve } from '@hono/node-server'
import type { Server as HttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'
import { z } from 'zod'
import { app } from './app.js'
import { env } from './env.js'
import { authenticateUpgrade } from './sync/authenticate.js'
import { closeRedis } from './sync/stream.js'
import { closeDatabase } from './db/client.js'
import { removePresence, setTyping, touchPresence } from './presence/service.js'
import { canSendTransientEvent } from './safety/service.js'
import { shutdownTelemetry } from './ops/instrumentation.js'
import { logger } from './ops/logger.js'
import { callEnvelope, callRecipient, callSignalPayload } from './calls/service.js'
import { publishCallSignal, startCallRelay } from './calls/relay.js'

const server = serve({ fetch: app.fetch, port: env.PORT }, () => logger.info({ port: env.PORT }, 'Quickchat API listening')) as HttpServer
const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })
const userSockets = new Map<string, Set<WebSocket>>()
const instanceId = randomUUID()
const sendToLocalUser = (userId: string, envelope: Record<string, unknown>) => { const encoded = JSON.stringify(envelope); for (const peer of userSockets.get(userId) ?? []) if (peer.readyState === WebSocket.OPEN) peer.send(encoded) }
const callRelay = startCallRelay(instanceId, ({ recipientId, envelope }) => sendToLocalUser(recipientId, envelope)).catch(() => undefined)

sockets.on('connection', async (socket, request) => {
  const auth = await authenticateUpgrade(request).catch(() => null)
  if (!auth) return socket.close(1008, 'Authentication required')
  const connections = userSockets.get(auth.userId) ?? new Set<WebSocket>(); connections.add(socket); userSockets.set(auth.userId, connections)
  await touchPresence(auth.userId, auth.sessionId).catch(() => undefined)
  let alive = true
  socket.on('pong', () => { alive = true })
  socket.on('message', (raw) => {
    let value: unknown
    try { value = JSON.parse(raw.toString()) } catch { return socket.close(1007, 'Invalid payload') }
    const event = clientSocketEventSchema.safeParse(value)
    if (!event.success) return socket.send(JSON.stringify({ version: 1, type: 'error', eventId: randomUUID(), requestId: typeof value === 'object' && value && 'requestId' in value ? String(value.requestId) : undefined, occurredAt: new Date().toISOString(), payload: { code: 'INVALID_EVENT' } }))
    if (event.data.type === 'ping') { touchPresence(auth.userId, auth.sessionId).catch(() => undefined); socket.send(JSON.stringify({ version: 1, type: 'pong', eventId: randomUUID(), requestId: event.data.requestId, occurredAt: new Date().toISOString(), payload: { sentAt: event.data.sentAt } })) }
    if (event.data.type === 'typing.update') {
      const typingEvent = event.data; const payload = z.object({ active: z.boolean() }).safeParse(typingEvent.payload)
      if (payload.success) canSendTransientEvent(typingEvent.conversationId, auth.userId).then(async (allowed) => { if (allowed) await setTyping(typingEvent.conversationId, auth.userId, payload.data.active) }).catch(() => undefined)
    }
    if (event.data.type.startsWith('call.') && 'payload' in event.data && 'conversationId' in event.data) {
      const callEvent = event.data; const signal = callSignalPayload.safeParse(callEvent.payload)
      if (signal.success && callEvent.type === `call.${signal.data.kind}`) callRecipient(callEvent.conversationId, auth.userId).then((recipientId) => {
        if (!recipientId) return
        const envelope = callEnvelope(callEvent.type, callEvent.conversationId, auth.userId, signal.data, callEvent.requestId)
        sendToLocalUser(recipientId, envelope); publishCallSignal({ originId: instanceId, recipientId, envelope }).catch(() => undefined)
      }).catch(() => undefined)
    }
  })
  const heartbeat = setInterval(() => { if (!alive) return socket.terminate(); alive = false; socket.ping() }, 30000)
  socket.on('close', () => { clearInterval(heartbeat); connections.delete(socket); if (!connections.size) userSockets.delete(auth.userId); removePresence(auth.userId, auth.sessionId).catch(() => undefined) })
})

async function shutdown() {
  sockets.close(); const stopCallRelay = await callRelay; await stopCallRelay?.(); await Promise.allSettled([closeRedis(), closeDatabase(), shutdownTelemetry()]); server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10000).unref()
}
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown)

export { app }
