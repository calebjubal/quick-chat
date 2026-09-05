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
