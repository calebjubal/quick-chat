import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './auth/routes.js'
import { env } from './env.js'
import profile from './profile/routes.js'
import conversationRoutes from './conversations/routes.js'
import messageRoutes from './messages/routes.js'
import messageActions from './messages/actions.js'

export const app = new Hono()
app.use('*', cors({ origin: env.ALLOWED_ORIGINS.split(','), credentials: true }))
app.get('/', (context) => context.json({ name: 'Quickchat API', status: 'ok' }))
app.get('/health', (context) => context.json({ status: 'ok', transport: 'websocket' }))
app.route('/api/v1/auth', auth)
app.route('/api/v1', profile)
app.route('/api/v1/conversations', conversationRoutes)
app.route('/api/v1', messageRoutes)
app.route('/api/v1/messages', messageActions)
