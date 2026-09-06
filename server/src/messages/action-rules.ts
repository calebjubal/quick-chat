export const EDIT_WINDOW_MS = 15 * 60 * 1000
export const DELETE_WINDOW_MS = 48 * 60 * 60 * 1000
export const withinWindow = (createdAt: Date, windowMs: number, now = new Date()) => now.getTime() - createdAt.getTime() <= windowMs
