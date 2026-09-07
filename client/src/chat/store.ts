import { create } from 'zustand'
import { clientEnv } from '../env'
import { localDb } from '../offline/database'

export type Attachment = { id: string; fileName: string; kind: 'image' | 'video' | 'audio' | 'voice' | 'document'; mimeType: string; metadata?: Record<string, unknown> }
export type ChatMessage = { id: string; conversationId: string; senderId: string | null; sequence: number; kind?: string; body: string | null; attachment?: Attachment | null; createdAt: string; editedAt?: string | null; deletedForEveryoneAt?: string | null }
export type Participant = { id: string; displayName: string; username: string | null; avatarKey: string | null }
export type ConversationEntry = {
  conversation: { id: string; type: 'direct' | 'group' | 'shared'; title: string | null; createdBy: string; updatedAt: string; closedAt?: string | null }
  membership: { lastReadSequence: number; pinnedAt: string | null; mutedUntil: string | null; archivedAt: string | null }
  direction: 'created' | 'sent'
  participants: Participant[]
}

type SendInput = { body?: string; attachmentId?: string }
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
type ChatStore = {
  conversations: ConversationEntry[]; messages: Record<string, ChatMessage[]>; selectedId?: string; loading: boolean; error?: string
  loadConversations(): Promise<void>; select(id: string, refresh?: boolean): Promise<void>; send(userId: string, input: SendInput): Promise<ChatMessage | undefined>
  setInbox(id: string, patch: { pinned?: boolean; archived?: boolean; mutedUntil?: string | null }): Promise<void>
  createShared(title?: string): Promise<{ shareUrl: string; createdCount: number; createdLimit: number }>
  joinShared(token: string, displayName: string): Promise<void>; share(id: string): Promise<string>; close(id: string): Promise<void>
}

export const apiRequest = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json')
  const response = await fetch(`${clientEnv.VITE_API_URL}/api/v1${path}`, { credentials: 'include', ...init, headers })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new ApiError(data?.error?.message ?? 'Request failed', response.status)
  return data as T
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [], messages: {}, loading: false,
  async loadConversations() {
    set({ loading: true, error: undefined })
    try {
      const data = await apiRequest<{ conversations: ConversationEntry[] }>('/conversations')
      set({ conversations: data.conversations, loading: false })
      await localDb.conversations.bulkPut(data.conversations.map((entry) => ({ ...entry, cacheId: entry.conversation.id })))
      const current = get().selectedId
      if (current && !data.conversations.some((entry) => entry.conversation.id === current)) set({ selectedId: undefined })
    } catch (error) {
      const cached = await localDb.conversations.toArray()
      set({ conversations: cached, loading: false, error: cached.length ? undefined : error instanceof Error ? error.message : 'Unable to load conversations' })
    }
  },
  async select(id, refresh = false) {
    set({ selectedId: id })
    if (get().messages[id] && !refresh) return
    try {
      const data = await apiRequest<{ messages: ChatMessage[] }>(`/conversations/${id}/messages`)
      set((state) => ({ messages: { ...state.messages, [id]: data.messages } }))
      await localDb.messages.bulkPut(data.messages)
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { set((state) => ({ messages: { ...state.messages, [id]: [] }, error: error.message })); return }
      const cached = await localDb.messages.where('conversationId').equals(id).sortBy('sequence')
      set((state) => ({ messages: { ...state.messages, [id]: cached } }))
    }
  },
  async send(userId, input) {
    const id = get().selectedId; const body = input.body?.trim()
    if (!id || (!body && !input.attachmentId)) return
    const messageId = crypto.randomUUID()
    const optimistic: ChatMessage = { id: messageId, conversationId: id, senderId: userId, sequence: Number.MAX_SAFE_INTEGER, body: body ?? null, createdAt: new Date().toISOString() }
    set((state) => ({ messages: { ...state.messages, [id]: [...(state.messages[id] ?? []), optimistic] } }))
    try {
      const data = await apiRequest<{ message: ChatMessage }>(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ id: messageId, body: body || undefined, attachmentId: input.attachmentId }) })
      set((state) => ({ messages: { ...state.messages, [id]: state.messages[id].map((message) => message.id === messageId ? data.message : message) } }))
      await localDb.messages.put(data.message)
      return data.message
    } catch (error) {
      if (input.attachmentId || error instanceof ApiError) set((state) => ({ messages: { ...state.messages, [id]: state.messages[id].filter((message) => message.id !== messageId) }, error: error instanceof Error ? error.message : 'Unable to send attachment' }))
      else {
        await localDb.outbox.put({ id: messageId, kind: 'message.send', conversationId: id, payload: { id: messageId, body }, createdAt: new Date().toISOString(), attempts: 0 })
        await localDb.messages.put(optimistic)
      }
      if (error instanceof Error) set({ error: error.message })
      return undefined
    }
  },
  async setInbox(id, patch) { await apiRequest(`/conversations/${id}/inbox`, { method: 'PATCH', body: JSON.stringify(patch) }); await get().loadConversations() },
  async createShared(title) { const result = await apiRequest<{ shareUrl: string; createdCount: number; createdLimit: number }>('/conversations/shared', { method: 'POST', body: JSON.stringify({ title: title || undefined }) }); await get().loadConversations(); return result },
  async joinShared(token, displayName) { const result = await apiRequest<{ conversation: { id: string } }>(`/conversations/shared/${encodeURIComponent(token)}/join`, { method: 'POST', body: JSON.stringify({ displayName }) }); await get().loadConversations(); await get().select(result.conversation.id, true) },
  async share(id) { const result = await apiRequest<{ shareUrl: string }>(`/conversations/${id}/share`, { method: 'POST' }); return result.shareUrl },
  async close(id) { await apiRequest(`/conversations/${id}`, { method: 'DELETE' }); set({ selectedId: undefined }); await get().loadConversations() },
}))
