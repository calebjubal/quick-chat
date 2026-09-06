import { clientSocketEventSchema } from '@quickchat/contracts'
import { serve } from '@hono/node-server'
import type { Server as HttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { app } from './app.js'
import { env } from './env.js'
import { authenticateUpgrade } from './sync/authenticate.js'
import { closeRedis } from './sync/stream.js'
import { closeDatabase } from './db/client.js'

const server = serve({ fetch: app.fetch, port: env.PORT }, () => console.log(`Quickchat API listening on http://localhost:${env.PORT}`)) as HttpServer
const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })

sockets.on('connection', async (socket, request) => {
  const auth = await authenticateUpgrade(request).catch(() => null)
  if (!auth) return socket.close(1008, 'Authentication required')
  let alive = true
  socket.on('pong', () => { alive = true })
  socket.on('message', (raw) => {
    let value: unknown
    try { value = JSON.parse(raw.toString()) } catch { return socket.close(1007, 'Invalid payload') }
    const event = clientSocketEventSchema.safeParse(value)
    if (!event.success) return socket.send(JSON.stringify({ version: 1, type: 'error', eventId: randomUUID(), requestId: typeof value === 'object' && value && 'requestId' in value ? String(value.requestId) : undefined, occurredAt: new Date().toISOString(), payload: { code: 'INVALID_EVENT' } }))
    if (event.data.type === 'ping') socket.send(JSON.stringify({ version: 1, type: 'pong', eventId: randomUUID(), requestId: event.data.requestId, occurredAt: new Date().toISOString(), payload: { sentAt: event.data.sentAt } }))
  })
  const heartbeat = setInterval(() => { if (!alive) return socket.terminate(); alive = false; socket.ping() }, 30000)
  socket.on('close', () => clearInterval(heartbeat))
})

async function shutdown() {
  sockets.close(); await Promise.allSettled([closeRedis(), closeDatabase()]); server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10000).unref()
}
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown)

export { app }
