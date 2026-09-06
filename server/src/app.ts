import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { ZodError } from 'zod'
import auth from './auth/routes.js'
import { env } from './env.js'
import profile from './profile/routes.js'
import conversationRoutes from './conversations/routes.js'
import messageRoutes from './messages/routes.js'
import messageActions from './messages/actions.js'
import mediaRoutes from './media/routes.js'
import presenceRoutes from './presence/routes.js'
import notificationRoutes from './notifications/routes.js'
import safetyRoutes from './safety/routes.js'
import settingsRoutes from './settings/routes.js'
import { captureException } from './ops/instrumentation.js'
import { logger } from './ops/logger.js'
import { observeRequests, protectOrigin, rateLimit } from './ops/middleware.js'
import type { AppVariables } from './auth/middleware.js'
import { db } from './db/client.js'
import { sql } from 'drizzle-orm'
import { getRedis } from './sync/stream.js'

export const app = new Hono<{ Variables: AppVariables }>()
app.use('*', observeRequests)
app.use('*', secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }, strictTransportSecurity: env.NODE_ENV === 'production' ? 'max-age=63072000; includeSubDomains; preload' : false }))
app.use('*', cors({ origin: env.ALLOWED_ORIGINS.split(','), credentials: true, allowHeaders: ['Content-Type', 'X-Request-Id'], exposeHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining'] }))
app.use('/api/*', protectOrigin)
app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024, onError: (context) => context.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large' } }, 413) }))
app.use('/api/*', rateLimit())
app.use('/api/v1/auth/*', rateLimit(30, 'auth'))
app.get('/', (context) => context.json({ name: 'Quickchat API', status: 'ok' }))
app.get('/health', (context) => context.json({ status: 'ok', transport: 'websocket' }))
app.get('/health/live', (context) => context.json({ status: 'live' }))
app.get('/health/ready', async (context) => {
  const dependencies = { postgres: false, redis: false }
  try { await db.execute(sql`select 1`); dependencies.postgres = true } catch { /* Report dependency as unavailable. */ }
  try { dependencies.redis = await getRedis().ping() === 'PONG' } catch { /* Report dependency as unavailable. */ }
  return dependencies.postgres && dependencies.redis ? context.json({ status: 'ready', dependencies }) : context.json({ status: 'not_ready', dependencies }, 503)
})
app.route('/api/v1/auth', auth)
app.route('/api/v1', profile)
app.route('/api/v1/conversations', conversationRoutes)
app.route('/api/v1', messageRoutes)
app.route('/api/v1/messages', messageActions)
app.route('/api/v1/uploads', mediaRoutes)
app.route('/api/v1', presenceRoutes)
app.route('/api/v1/push-subscriptions', notificationRoutes)
app.route('/api/v1', safetyRoutes)
app.route('/api/v1', settingsRoutes)
app.onError((error, context) => {
  if (error instanceof ZodError) return context.json({ error: { code: 'INVALID_REQUEST', message: 'Request validation failed', requestId: context.get('requestId') } }, 422)
  captureException(error, context.get('requestId')); logger.error({ requestId: context.get('requestId'), error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : 'Unknown error' }, 'request failed')
  return context.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId: context.get('requestId') } }, 500)
})
