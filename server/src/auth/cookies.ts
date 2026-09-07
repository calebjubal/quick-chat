import { env } from '../env.js'

export const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'None', sameSite: env.COOKIE_SAME_SITE, path: '/', maxAge: env.SESSION_TTL_DAYS * 86400 }
