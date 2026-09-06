import { createHash, randomUUID } from 'node:crypto'
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api'
import { createMiddleware } from 'hono/factory'
import { type AppVariables } from '../auth/middleware.js'
import { env } from '../env.js'
import { getRedis } from '../sync/stream.js'
import { captureException } from './instrumentation.js'
import { logger } from './logger.js'

const requestCounter = metrics.getMeter('quickchat-api').createCounter('http.server.requests')
const requestDuration = metrics.getMeter('quickchat-api').createHistogram('http.server.duration', { unit: 'ms' })
const fallbackCounters = new Map<string, { count: number; expiresAt: number }>()

export const safeRequestId = (value?: string) => value && /^[a-zA-Z0-9_-]{8,80}$/.test(value) ? value : randomUUID()
export const rateLimitKey = (address: string, bucket: number) => createHash('sha256').update(`${env.RATE_LIMIT_SALT}:${address}:${bucket}`).digest('hex')
const clientAddress = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown'

export const observeRequests = createMiddleware<{ Variables: AppVariables }>(async (context, next) => {
  const requestId = safeRequestId(context.req.header('x-request-id')); const started = performance.now(); const path = new URL(context.req.url).pathname
  context.set('requestId', requestId); context.header('x-request-id', requestId)
  const span = trace.getTracer('quickchat-api').startSpan(`${context.req.method} ${path}`)
  try {
    await next(); span.setAttribute('http.response.status_code', context.res.status); span.setStatus({ code: context.res.status >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK })
  } catch (error) {
    span.recordException(error as Error); span.setStatus({ code: SpanStatusCode.ERROR }); captureException(error, requestId); throw error
  } finally {
    const durationMs = performance.now() - started; const attributes = { method: context.req.method, route: path, status: context.res.status }
    requestCounter.add(1, attributes); requestDuration.record(durationMs, attributes); logger.info({ requestId, ...attributes, durationMs: Math.round(durationMs) }, 'request completed'); span.end()
  }
})

export const protectOrigin = createMiddleware(async (context, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) {
    const origin = context.req.header('origin')
    if (origin && !env.ALLOWED_ORIGINS.split(',').includes(origin)) return context.json({ error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed' } }, 403)
  }
  await next()
})

export const rateLimit = (limit = env.GLOBAL_RATE_LIMIT_PER_MINUTE, namespace = 'global') => createMiddleware(async (context, next) => {
  const bucket = Math.floor(Date.now() / 60000); const key = `rate:${namespace}:${rateLimitKey(clientAddress(context.req.raw.headers), bucket)}`
  let count: number
  try { count = await getRedis().incr(key); if (count === 1) await getRedis().expire(key, 61) }
  catch {
    const now = Date.now(); const current = fallbackCounters.get(key); count = current && current.expiresAt > now ? current.count + 1 : 1; fallbackCounters.set(key, { count, expiresAt: now + 61000 })
    if (fallbackCounters.size > 10_000) for (const [entryKey, entry] of fallbackCounters) if (entry.expiresAt <= now) fallbackCounters.delete(entryKey)
  }
  context.header('ratelimit-limit', String(limit)); context.header('ratelimit-remaining', String(Math.max(0, limit - count)))
  if (count > limit) { context.header('retry-after', '60'); return context.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } }, 429) }
  await next()
})
