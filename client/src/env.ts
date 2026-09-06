import { z } from 'zod'

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
  VITE_WS_URL: z.string().url().default('ws://localhost:3000/ws'),
  VITE_VAPID_PUBLIC_KEY: z.string().default(''),
  VITE_STUN_URL: z.string().default('stun:stun.cloudflare.com:3478'),
  VITE_TURN_URL: z.string().default(''),
  VITE_TURN_USERNAME: z.string().default(''),
  VITE_TURN_CREDENTIAL: z.string().default(''),
})

export const clientEnv = clientEnvSchema.parse(import.meta.env)
