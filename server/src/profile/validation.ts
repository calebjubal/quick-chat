import { z } from 'zod'

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, 'Use 3–32 letters, numbers, or underscores')
export const normalizeUsername = (value: string) => usernameSchema.parse(value)
