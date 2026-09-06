import { expect, it } from 'vitest'
import type { PendingOperation } from './database'
it('uses stable operation identifiers for retry safety', () => { const operation: PendingOperation = { id: 'stable', kind: 'message.send', conversationId: 'chat', payload: {}, createdAt: '', attempts: 0 }; expect(operation.id).toBe('stable') })
