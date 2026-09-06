import { z } from 'zod'

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
  VITE_WS_URL: z.string().url().default('ws://localhost:3000/ws'),
  VITE_VAPID_PUBLIC_KEY: z.string().default(''),
})

export const clientEnv = clientEnvSchema.parse(import.meta.env)
