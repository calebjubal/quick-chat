import { create } from 'zustand'
import { clientEnv } from '../env'
import { localDb } from '../offline/database'

export type ChatMessage = { id: string; conversationId: string; senderId: string | null; sequence: number; body: string | null; createdAt: string; editedAt?: string | null; deletedForEveryoneAt?: string | null }
export type Participant = { id: string; displayName: string; username: string | null; avatarKey: string | null }
export type ConversationEntry = { conversation: { id: string; type: 'direct' | 'group'; title: string | null; updatedAt: string }; membership: { lastReadSequence: number; pinnedAt: string | null; mutedUntil: string | null; archivedAt: string | null }; participants: Participant[] }

type ChatStore = {
  conversations: ConversationEntry[]; messages: Record<string, ChatMessage[]>; selectedId?: string; loading: boolean; error?: string
  loadConversations(): Promise<void>; select(id: string): Promise<void>; send(userId: string, body: string): Promise<void>; setInbox(id: string, patch: { pinned?: boolean; archived?: boolean; mutedUntil?: string | null }): Promise<void>
}

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${clientEnv.VITE_API_URL}/api/v1${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'Request failed')
  return data
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [], messages: {}, loading: false,
  async loadConversations() { set({ loading: true, error: undefined }); try { const data = await request('/conversations'); set({ conversations: data.conversations, loading: false }); await localDb.conversations.bulkPut(data.conversations.map((entry: ConversationEntry) => ({ ...entry, cacheId: entry.conversation.id }))); if (!get().selectedId && data.conversations[0]) await get().select(data.conversations[0].conversation.id) } catch (error) { const cached = await localDb.conversations.toArray(); set({ conversations: cached, loading: false, error: cached.length ? undefined : error instanceof Error ? error.message : 'Unable to load conversations' }) } },
  async select(id) { set({ selectedId: id }); if (get().messages[id]) return; try { const data = await request(`/conversations/${id}/messages`); set((state) => ({ messages: { ...state.messages, [id]: data.messages } })); await localDb.messages.bulkPut(data.messages) } catch { const cached = await localDb.messages.where('conversationId').equals(id).sortBy('sequence'); set((state) => ({ messages: { ...state.messages, [id]: cached } })) } },
  async send(userId, body) {
    const id = get().selectedId; if (!id || !body.trim()) return
    const messageId = crypto.randomUUID(); const optimistic: ChatMessage = { id: messageId, conversationId: id, senderId: userId, sequence: Number.MAX_SAFE_INTEGER, body: body.trim(), createdAt: new Date().toISOString() }
    set((state) => ({ messages: { ...state.messages, [id]: [...(state.messages[id] ?? []), optimistic] } }))
    try { const data = await request(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ id: messageId, body }) }); set((state) => ({ messages: { ...state.messages, [id]: state.messages[id].map((message) => message.id === messageId ? data.message : message) } })); await localDb.messages.put(data.message) } catch { await localDb.outbox.put({ id: messageId, kind: 'message.send', conversationId: id, payload: { id: messageId, body }, createdAt: new Date().toISOString(), attempts: 0 }); await localDb.messages.put(optimistic) }
  },
  async setInbox(id, patch) { await request(`/conversations/${id}/inbox`, { method: 'PATCH', body: JSON.stringify(patch) }); await get().loadConversations() },
}))
