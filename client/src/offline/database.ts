import Dexie, { type EntityTable } from 'dexie'
import type { ChatMessage, ConversationEntry } from '../chat/store'

export type PendingOperation = { id: string; kind: 'message.send'; conversationId: string; payload: Record<string, unknown>; createdAt: string; attempts: number }
class QuickchatDatabase extends Dexie {
  conversations!: EntityTable<ConversationEntry & { cacheId: string }, 'cacheId'>
  messages!: EntityTable<ChatMessage, 'id'>
  outbox!: EntityTable<PendingOperation, 'id'>
  drafts!: EntityTable<{ conversationId: string; body: string }, 'conversationId'>
  constructor() { super('quickchat'); this.version(1).stores({ conversations: 'cacheId, conversation.updatedAt', messages: 'id, conversationId, [conversationId+sequence]', outbox: 'id, createdAt', drafts: 'conversationId' }) }
}
export const localDb = new QuickchatDatabase()
export const clearLocalAccountData = () => localDb.transaction('rw', localDb.tables, () => Promise.all(localDb.tables.map((table) => table.clear())))
