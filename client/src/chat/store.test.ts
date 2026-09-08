// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../offline/database', () => ({ localDb: { conversations: { bulkPut: vi.fn(), toArray: vi.fn().mockResolvedValue([]) }, messages: { put: vi.fn(), bulkPut: vi.fn() } } }))
import { useChatStore } from './store'
afterEach(() => { vi.unstubAllGlobals(); useChatStore.setState({ conversations: [], messages: {}, selectedId: undefined, error: undefined }) })
it('reports a failed send without leaving a fake delivered message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  useChatStore.setState({ selectedId: 'room', messages: { room: [] } })
  expect(await useChatStore.getState().send('sender', { body: 'hello' })).toBeUndefined()
  expect(useChatStore.getState().messages.room).toEqual([])
  expect(useChatStore.getState().error).toBe('offline')
})
it('keeps the acknowledged message if polling removed its optimistic placeholder', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const input = JSON.parse(init.body)
    useChatStore.setState({ messages: { room: [] } })
    return { ok: true, status: 201, json: async () => ({ message: { ...input, sequence: 1, conversationId: 'room', senderId: 'sender', createdAt: new Date().toISOString() } }) }
  }))
  useChatStore.setState({ selectedId: 'room', messages: { room: [] } })
  await useChatStore.getState().send('sender', { body: 'hello' })
  expect(useChatStore.getState().messages.room).toHaveLength(1)
  expect(useChatStore.getState().messages.room[0].sequence).toBe(1)
})
