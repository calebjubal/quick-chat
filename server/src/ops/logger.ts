import pino from 'pino'
import { env } from '../env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'quickchat-api', environment: env.NODE_ENV },
  redact: {
    paths: ['password', '*.password', 'token', '*.token', 'sessionToken', '*.sessionToken', 'body', '*.body', 'inviteToken', '*.inviteToken', 'signedUrl', '*.signedUrl', 'authorization', '*.authorization', 'cookie', '*.cookie'],
    censor: '[REDACTED]',
  },
})
