import { expect, it } from 'vitest'
import { serverEnvSchema } from './env.js'
it('starts production without Redis, storage, scanning or push configuration', () => {
  const result = serverEnvSchema.safeParse({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://test:test@db.example.com/db?sslmode=require', APP_URL: 'https://chat.example.com', ALLOWED_ORIGINS: 'https://chat.example.com', RATE_LIMIT_SALT: 'a-unique-production-secret-value', SMTP_HOST: 'smtp.example.com' })
  expect(result.success).toBe(true)
})
it('still requires public HTTPS origins and a production rate-limit secret', () => {
  expect(serverEnvSchema.safeParse({ NODE_ENV: 'production' }).success).toBe(false)
})
it('allows secure guest access before email delivery is configured', () => {
  expect(serverEnvSchema.safeParse({ NODE_ENV: 'production', APP_URL: 'https://chat.example.com', ALLOWED_ORIGINS: 'https://chat.example.com', RATE_LIMIT_SALT: 'a-unique-production-secret-value' }).success).toBe(true)
})
