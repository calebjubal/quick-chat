import { and, eq, gt, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { db } from '../db/client.js'
import { accountTokens, credentials, sessions, users } from '../db/schema.js'
import { env } from '../env.js'
import { type AppVariables, requireAuth, sessionCookieName } from './middleware.js'
import { sendAccountEmail } from './mailer.js'
import { createToken, hashPassword, hashToken, normalizeEmail, verifyPassword } from './security.js'
import { randomUUID } from 'node:crypto'
import { guestUpgradeSchema, passwordSchema } from './validation.js'

const auth = new Hono<{ Variables: AppVariables }>()
const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'None', sameSite: env.COOKIE_SAME_SITE, path: '/', maxAge: env.SESSION_TTL_DAYS * 86400 }

auth.post('/register', async (context) => {
  const input = z.object({ email: z.string().email(), password: passwordSchema, displayName: z.string().trim().min(1).max(80) }).parse(await context.req.json())
  const emailNormalized = normalizeEmail(input.email)
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.emailNormalized, emailNormalized)).limit(1)
  if (existing) return context.json({ error: { code: 'EMAIL_TAKEN', message: 'An account already exists for this email' } }, 409)
  const verificationToken = createToken()
  const user = await db.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({ email: input.email.trim(), emailNormalized, displayName: input.displayName }).returning()
    await tx.insert(credentials).values({ userId: created.id, passwordHash: await hashPassword(input.password) })
    await tx.insert(accountTokens).values({ userId: created.id, type: 'verify_email', tokenHash: hashToken(verificationToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    return created
  })
  await sendAccountEmail(user.email, 'Verify your Quickchat account', `${env.APP_URL}/verify?token=${encodeURIComponent(verificationToken)}`)
  return context.json({ userId: user.id, verificationRequired: true }, 201)
})

auth.post('/guest', async (context) => {
  const { displayName } = z.object({ displayName: z.string().trim().min(1).max(80) }).parse(await context.req.json())
  const id = randomUUID(); const token = createToken(); const csrf = createToken()
  const guest = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ id, email: `guest-${id}@guest.invalid`, emailNormalized: `guest-${id}@guest.invalid`, emailVerifiedAt: new Date(), displayName, accountKind: 'guest' }).returning()
    await tx.insert(sessions).values({ userId: id, tokenHash: hashToken(token), csrfHash: hashToken(csrf), expiresAt: new Date(Date.now() + 7 * 86400000), userAgent: context.req.header('user-agent') })
    return user
  })
  setCookie(context, sessionCookieName, token, { ...cookieOptions, maxAge: 7 * 86400 })
  return context.json({ user: { id: guest.id, displayName: guest.displayName, username: null, isGuest: true }, csrfToken: csrf }, 201)
})

auth.post('/guest/upgrade', requireAuth, async (context) => {
  const actor = context.get('user')
  if (!actor.isGuest) return context.json({ error: { code: 'ALREADY_REGISTERED', message: 'This profile already has an account' } }, 409)
  const input = guestUpgradeSchema.parse(await context.req.json())
  const emailNormalized = normalizeEmail(input.email)
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.emailNormalized, emailNormalized)).limit(1)
  if (existing && existing.id !== actor.id) return context.json({ error: { code: 'EMAIL_TAKEN', message: 'An account already exists for this email' } }, 409)
  const verificationToken = createToken()
  await db.transaction(async (tx) => {
    await tx.update(users).set({ email: input.email.trim(), emailNormalized, emailVerifiedAt: null, accountKind: 'registered', updatedAt: new Date() }).where(eq(users.id, actor.id))
    await tx.insert(credentials).values({ userId: actor.id, passwordHash: await hashPassword(input.password) })
    await tx.insert(accountTokens).values({ userId: actor.id, type: 'verify_email', tokenHash: hashToken(verificationToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, actor.id))
  })
  await sendAccountEmail(input.email.trim(), 'Verify your Quickchat account', `${env.APP_URL}/verify?token=${encodeURIComponent(verificationToken)}`)
  deleteCookie(context, sessionCookieName, { path: '/' })
  return context.json({ upgraded: true, verificationRequired: true })
})

auth.post('/login', async (context) => {
  const input = z.object({ email: z.string().email(), password: z.string().max(128) }).parse(await context.req.json())
  const [record] = await db.select({ user: users, passwordHash: credentials.passwordHash }).from(users).innerJoin(credentials, eq(credentials.userId, users.id)).where(eq(users.emailNormalized, normalizeEmail(input.email))).limit(1)
  if (!record || !(await verifyPassword(record.passwordHash, input.password))) return context.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }, 401)
  if (!record.user.emailVerifiedAt) return context.json({ error: { code: 'EMAIL_UNVERIFIED', message: 'Verify your email before signing in' } }, 403)
  const token = createToken(); const csrf = createToken()
  await db.insert(sessions).values({ userId: record.user.id, tokenHash: hashToken(token), csrfHash: hashToken(csrf), expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 86400000), userAgent: context.req.header('user-agent') })
  setCookie(context, sessionCookieName, token, cookieOptions)
  return context.json({ user: { id: record.user.id, displayName: record.user.displayName, username: record.user.username, isGuest: false }, csrfToken: csrf })
})

auth.post('/verify', async (context) => {
  const { token } = z.object({ token: z.string().min(20) }).parse(await context.req.json())
  const [record] = await db.select().from(accountTokens).where(and(eq(accountTokens.tokenHash, hashToken(token)), eq(accountTokens.type, 'verify_email'), gt(accountTokens.expiresAt, new Date()), isNull(accountTokens.consumedAt))).limit(1)
  if (!record) return context.json({ error: { code: 'INVALID_TOKEN', message: 'Verification link is invalid or expired' } }, 400)
  await db.transaction(async (tx) => { await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, record.userId)); await tx.update(accountTokens).set({ consumedAt: new Date() }).where(eq(accountTokens.id, record.id)) })
  return context.json({ verified: true })
})

auth.post('/verification/resend', async (context) => {
  const { email } = z.object({ email: z.string().email() }).parse(await context.req.json())
  const [user] = await db.select().from(users).where(eq(users.emailNormalized, normalizeEmail(email))).limit(1)
  if (user && user.accountKind === 'registered' && !user.emailVerifiedAt) {
    const token = createToken()
    await db.insert(accountTokens).values({ userId: user.id, type: 'verify_email', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    await sendAccountEmail(user.email, 'Verify your Quickchat account', `${env.APP_URL}/verify?token=${encodeURIComponent(token)}`)
  }
  return context.json({ accepted: true })
})

auth.get('/session', requireAuth, (context) => context.json({ user: context.get('user') }))
auth.post('/logout', requireAuth, async (context) => { await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, context.get('sessionId'))); deleteCookie(context, sessionCookieName, { path: '/' }); return context.body(null, 204) })

auth.post('/password/request', async (context) => {
  const { email } = z.object({ email: z.string().email() }).parse(await context.req.json())
  const [user] = await db.select().from(users).where(eq(users.emailNormalized, normalizeEmail(email))).limit(1)
  if (user) { const token = createToken(); await db.insert(accountTokens).values({ userId: user.id, type: 'reset_password', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) }); await sendAccountEmail(user.email, 'Reset your Quickchat password', `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`) }
  return context.json({ accepted: true })
})

auth.post('/password/reset', async (context) => {
  const input = z.object({ token: z.string().min(20), password: passwordSchema }).parse(await context.req.json())
  const [record] = await db.select().from(accountTokens).where(and(eq(accountTokens.tokenHash, hashToken(input.token)), eq(accountTokens.type, 'reset_password'), gt(accountTokens.expiresAt, new Date()), isNull(accountTokens.consumedAt))).limit(1)
  if (!record) return context.json({ error: { code: 'INVALID_TOKEN', message: 'Reset link is invalid or expired' } }, 400)
  await db.transaction(async (tx) => { await tx.update(credentials).set({ passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() }).where(eq(credentials.userId, record.userId)); await tx.update(accountTokens).set({ consumedAt: new Date() }).where(eq(accountTokens.id, record.id)); await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, record.userId)) })
  return context.json({ reset: true })
})

export default auth
