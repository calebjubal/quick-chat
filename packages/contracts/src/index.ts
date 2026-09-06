import { z } from 'zod'

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
})

export const cursorPageSchema = z.object({ nextCursor: z.string().nullable() })

export const websocketEnvelopeSchema = z.object({
  version: z.literal(1),
  type: z.string(),
  eventId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  sequence: z.number().int().nonnegative().optional(),
  occurredAt: z.string().datetime(),
  payload: z.unknown(),
})

export type ApiError = z.infer<typeof apiErrorSchema>
export type WebsocketEnvelope = z.infer<typeof websocketEnvelopeSchema>

export const clientSocketEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping'), requestId: z.string().uuid(), sentAt: z.number() }),
  z.object({ type: z.literal('sync.resume'), requestId: z.string().uuid(), cursor: z.string().nullable() }),
  z.object({ type: z.literal('message.create'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
  z.object({ type: z.literal('receipt.update'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
  z.object({ type: z.literal('typing.update'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
  z.object({ type: z.literal('call.offer'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
  z.object({ type: z.literal('call.answer'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
  z.object({ type: z.literal('call.ice'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
  z.object({ type: z.literal('call.end'), requestId: z.string().uuid(), conversationId: z.string().uuid(), payload: z.unknown() }),
])

export type ClientSocketEvent = z.infer<typeof clientSocketEventSchema>
