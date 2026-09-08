// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChatWorkspace } from './ChatWorkspace'
import { useChatStore, type ConversationEntry } from './store'

vi.mock('../lib/polling', () => ({ startPolling: () => () => {} }))
const guest = { id: 'guest-id', displayName: 'Alex', username: null, isGuest: true }
const entry = (id: string, direction: 'created' | 'sent'): ConversationEntry => ({ conversation: { id, type: 'shared', title: id, createdBy: direction === 'created' ? guest.id : 'other', updatedAt: new Date().toISOString() }, direction, participants: [], membership: { lastReadSequence: 0, pinnedAt: null, mutedUntil: null, archivedAt: null } })
const props = { user: guest, onJoinComplete: vi.fn(), onSignedOut: vi.fn(), onRequireAccount: vi.fn() }
beforeEach(() => { useChatStore.setState({ conversations: [], messages: {}, selectedId: undefined, error: undefined, loading: false, loadConversations: vi.fn().mockResolvedValue(undefined) }) })
afterEach(cleanup)

describe('guest chat workspace', () => {
  it('separates created and received chats', () => {
    useChatStore.setState({ conversations: [entry('Created room', 'created'), entry('Received room', 'sent')] })
    render(<ChatWorkspace {...props} />)
    expect(screen.queryByText('Created room')).not.toBeNull()
    expect(screen.queryByText('Received room')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Sent to you' }))
    expect(screen.queryByText('Received room')).not.toBeNull()
    expect(screen.queryByText('Created room')).toBeNull()
  })
  it('shows text controls without development-only features', () => {
    useChatStore.setState({ conversations: [entry('Room', 'created')], selectedId: 'Room' })
    render(<ChatWorkspace {...props} />)
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Record voice note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Attach file' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start video call' })).toBeNull()
  })
  it('asks for a name before joining an invitation', () => {
    render(<ChatWorkspace {...props} joinToken="test-invitation" />)
    expect(screen.getByRole('heading', { name: 'What should we call you?' })).not.toBeNull()
    expect(screen.getByRole('textbox', { name: 'Your name' })).not.toBeNull()
  })
})
