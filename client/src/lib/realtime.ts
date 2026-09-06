import { websocketEnvelopeSchema, type ClientSocketEvent, type WebsocketEnvelope } from '@quickchat/contracts'
import { clientEnv } from '../env'

export const retryDelay = (attempt: number) => Math.min(30000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)

export class RealtimeClient extends EventTarget {
  private socket?: WebSocket
  private attempt = 0
  private stopped = false

  connect() {
    this.stopped = false
    this.socket = new WebSocket(clientEnv.VITE_WS_URL)
    this.socket.onopen = () => { this.attempt = 0; this.dispatchEvent(new Event('connected')) }
    this.socket.onmessage = (event) => {
      const parsed = websocketEnvelopeSchema.safeParse(JSON.parse(String(event.data)))
      if (parsed.success) this.dispatchEvent(new CustomEvent<WebsocketEnvelope>('event', { detail: parsed.data }))
    }
    this.socket.onclose = () => {
      this.dispatchEvent(new Event('disconnected'))
      if (!this.stopped) window.setTimeout(() => this.connect(), retryDelay(this.attempt++))
    }
  }

  send(event: ClientSocketEvent) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(JSON.stringify(event)); return true
  }

  close() { this.stopped = true; this.socket?.close() }
}
