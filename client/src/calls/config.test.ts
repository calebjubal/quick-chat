import { describe, expect, it } from 'vitest'
import { createIceServers } from './config'

describe('call transport configuration', () => {
  it('always provides a STUN discovery server', () => expect(createIceServers()[0].urls).toBeTruthy())
})
