import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { db } from '../db/client.js'
import { pushSubscriptions } from '../db/schema.js'
import { env } from '../env.js'
import { endpointHash, setNotificationFocus } from './service.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
})

routes.get('/vapid-key', (context) => context.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null }))
routes.post('/', async (context) => {
  const input = subscriptionSchema.parse(await context.req.json())
  const userId = context.get('user').id
  const hash = endpointHash(input.endpoint)
  const [subscription] = await db.insert(pushSubscriptions).values({
    userId,
    endpointHash: hash,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: context.req.header('user-agent')?.slice(0, 500),
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpointHash,
    set: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, updatedAt: new Date() },
  }).returning({ id: pushSubscriptions.id })
  return context.json({ subscription }, 201)
})
routes.delete('/', async (context) => {
  const input = z.object({ endpoint: z.string().url() }).parse(await context.req.json())
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpointHash, endpointHash(input.endpoint)), eq(pushSubscriptions.userId, context.get('user').id)))
  return context.body(null, 204)
})
routes.put('/focus', async (context) => {
  const input = z.object({ conversationId: z.string().uuid().nullable() }).parse(await context.req.json())
  await setNotificationFocus(context.get('user').id, input.conversationId)
  return context.json({ updated: true })
})

export default routes
