import { z } from 'zod'

export const passwordSchema = z.string().min(12).max(128)
export const guestUpgradeSchema = z.object({ email: z.string().email(), password: passwordSchema })
