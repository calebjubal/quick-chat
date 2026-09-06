import { randomUUID } from 'node:crypto'

export function liveEventEnvelope(conversationId: string, event: Record<string, unknown>) {
  const rawMessage = event.message && typeof event.message === 'object' ? event.message as Record<string, unknown> : undefined
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : event
  const nestedMessage = payload.message && typeof payload.message === 'object' ? payload.message as Record<string, unknown> : undefined
  return { version: 1 as const, type: String(event.type ?? 'conversation.updated'), eventId: String(event.id ?? event.outboxId ?? randomUUID()), conversationId, sequence: Number(rawMessage?.sequence ?? nestedMessage?.sequence ?? 0), occurredAt: String(event.occurredAt ?? new Date().toISOString()), payload }
}
