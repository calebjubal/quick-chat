import { z } from 'zod'

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  DATABASE_URL: z.string().url().default('postgres://quickchat:quickchat@localhost:5432/quickchat'),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  APP_URL: z.string().url().default('http://localhost:5173'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Quickchat <no-reply@quickchat.local>'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  RATE_LIMIT_SALT: z.string().min(16).default('quickchat-development-rate-limit-salt'),
  GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  COOKIE_SAME_SITE: z.enum(['Lax', 'Strict', 'None']).default('Lax'),
  GUEST_MESSAGE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(50),
  USER_MESSAGE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(1000),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return
  if (value.ALLOWED_ORIGINS.includes('localhost') || value.ALLOWED_ORIGINS.includes('127.0.0.1')) context.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'Production origins cannot use localhost' })
  if (value.RATE_LIMIT_SALT === 'quickchat-development-rate-limit-salt') context.addIssue({ code: 'custom', path: ['RATE_LIMIT_SALT'], message: 'Set a unique production rate-limit salt' })
  if (new URL(value.APP_URL).protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(new URL(value.APP_URL).hostname)) context.addIssue({ code: 'custom', path: ['APP_URL'], message: 'Production app URL must use public HTTPS' })
})

export const env = serverEnvSchema.parse(process.env)
