import { z } from 'zod'

const clientEnvSchema = z.object({
  VITE_API_URL: z.union([z.literal(''), z.string().url()]).default(''),
})

export const clientEnv = clientEnvSchema.parse({ ...import.meta.env, ...(import.meta.env.PROD ? { VITE_API_URL: '' } : {}) })
