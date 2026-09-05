import { serve } from '@hono/node-server'
import type { Server as HttpServer } from 'node:http'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocket, WebSocketServer } from 'ws'
import { z } from 'zod'
import { env } from './env.js'

const app = new Hono()

app.use('*', cors({ origin: env.ALLOWED_ORIGINS.split(',') }))
app.get('/', (context) => context.json({ name: 'Quickchat sync service', status: 'ok' }))
app.get('/health', (context) => context.json({ status: 'ok', transport: 'websocket' }))

const messageEnvelope = z.object({
  type: z.literal('message'),
  clientId: z.string().min(1),
  chatId: z.string().min(1),
  message: z.object({
    id: z.number(),
    body: z.string().trim().min(1).max(4000),
    time: z.string(),
  }),
})

const pingEnvelope = z.object({ type: z.literal('ping'), sentAt: z.number() })

const port = env.PORT
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Quickchat sync service listening on http://localhost:${port}`)
}) as HttpServer
const sockets = new WebSocketServer({ server, path: '/ws' })

sockets.on('connection', (socket) => {
  socket.on('message', (payload) => {
    let value: unknown
    try {
      value = JSON.parse(payload.toString())
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }))
      return
    }

    const ping = pingEnvelope.safeParse(value)
    if (ping.success) {
      socket.send(JSON.stringify({ type: 'pong', sentAt: ping.data.sentAt }))
      return
    }

    const message = messageEnvelope.safeParse(value)
    if (!message.success) {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid message payload' }))
      return
    }

    const encoded = JSON.stringify(message.data)
    for (const client of sockets.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(encoded)
    }
  })
})

export default app
