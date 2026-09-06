import { Hono } from 'hono'
import { z } from 'zod'
import { type AppVariables, requireAuth } from '../auth/middleware.js'
import { presenceFor } from './service.js'
import { isBlockedBetween } from '../safety/service.js'

const routes = new Hono<{ Variables: AppVariables }>()
routes.use('*', requireAuth)
routes.post('/presence', async (context) => {
  const { userIds } = z.object({ userIds: z.array(z.string().uuid()).max(256) }).parse(await context.req.json())
  const actorId = context.get('user').id
  const statuses = Object.fromEntries(await Promise.all([...new Set(userIds)].map(async (id) => [id, await isBlockedBetween(actorId, id) ? false : await presenceFor(id)] as const)))
  return context.json({ statuses })
})
export default routes
