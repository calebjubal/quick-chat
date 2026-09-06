import { env } from '../env.js'

export const CREATED_CHAT_LIMIT = 5
export const messageLimitFor = (isGuest: boolean) => isGuest ? env.GUEST_MESSAGE_LIMIT_PER_DAY : env.USER_MESSAGE_LIMIT_PER_DAY
export const uploadLimitFor = (isGuest: boolean) => isGuest ? env.GUEST_VOICE_LIMIT_PER_DAY : env.USER_FILE_LIMIT_PER_DAY
