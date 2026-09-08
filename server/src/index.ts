import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './env.js'
const server = serve({ fetch: app.fetch, port: env.PORT })
process.once('SIGTERM', () => server.close())
process.once('SIGINT', () => server.close())
export { app }
