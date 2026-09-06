import { getRedis } from '../sync/stream.js'

type RelayMessage = { originId: string; recipientId: string; envelope: Record<string, unknown> }

export async function startCallRelay(originId: string, receive: (message: RelayMessage) => void) {
  const subscriber = getRedis().duplicate(); await subscriber.subscribe('quickchat:calls')
  subscriber.on('message', (_channel, raw) => { try { const message = JSON.parse(raw) as RelayMessage; if (message.originId !== originId) receive(message) } catch { /* Ignore invalid internal events. */ } })
  return () => subscriber.quit()
}

export const publishCallSignal = (message: RelayMessage) => getRedis().publish('quickchat:calls', JSON.stringify(message))
