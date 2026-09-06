import { createHash, randomBytes } from 'node:crypto'
import argon2 from 'argon2'

export const normalizeEmail = (value: string) => value.trim().toLowerCase()
export const createToken = () => randomBytes(32).toString('base64url')
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export const hashPassword = (value: string) => argon2.hash(value, { type: argon2.argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 })
export const verifyPassword = (hash: string, value: string) => argon2.verify(hash, value)
