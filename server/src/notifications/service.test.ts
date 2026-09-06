import { describe, expect, it } from 'vitest'
import { endpointHash, notificationPayload } from './service.js'

describe('push notification privacy', () => {
  it('hashes endpoints and omits message content', () => {
    expect(endpointHash('https://push.example/sub')).toHaveLength(64)
    expect(notificationPayload('Taylor', '8da2a7a0-037a-4740-a7ee-ad0df1484c2f')).toEqual({
      title: 'Taylor',
      body: 'New message',
      conversationId: '8da2a7a0-037a-4740-a7ee-ad0df1484c2f',
      url: '/?conversation=8da2a7a0-037a-4740-a7ee-ad0df1484c2f',
      tag: 'conversation:8da2a7a0-037a-4740-a7ee-ad0df1484c2f',
    })
  })
})
