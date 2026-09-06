import { z } from 'zod'

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  DATABASE_URL: z.string().url().default('postgres://quickchat:quickchat@localhost:5432/quickchat'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Quickchat <no-reply@quickchat.local>'),
})

export const env = serverEnvSchema.parse(process.env)
