export const MAX_MESSAGE_LENGTH = 4000
export const messageCursor = (sequence: number) => Buffer.from(String(sequence)).toString('base64url')
export const parseMessageCursor = (cursor?: string) => cursor ? Number(Buffer.from(cursor, 'base64url').toString()) : Number.MAX_SAFE_INTEGER
