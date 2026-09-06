import http from 'k6/http'
import ws from 'k6/ws'
import { check } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const ackLatency = new Trend('message_ack_latency', true)
const ackErrors = new Rate('message_ack_errors')
const apiUrl = __ENV.K6_API_URL || 'http://127.0.0.1:3000'
const wsUrl = __ENV.K6_WS_URL || 'ws://127.0.0.1:3000/ws'
const cookieName = __ENV.K6_COOKIE_NAME || 'quickchat_session'
const token = __ENV.K6_SESSION_TOKEN || ''
const conversationId = __ENV.K6_CONVERSATION_ID || ''

export const options = {
  scenarios: {
    sockets: { executor: 'constant-vus', exec: 'socketSession', vus: 1000, duration: '2m', gracefulStop: '10s' },
    messages: { executor: 'constant-arrival-rate', exec: 'sendMessage', rate: 50, timeUnit: '1s', duration: '2m', preAllocatedVUs: 75, maxVUs: 250 },
    fanout: { executor: 'per-vu-iterations', exec: 'fanoutMember', vus: 256, iterations: 1, startTime: '15s', maxDuration: '90s' },
  },
  thresholds: { message_ack_latency: ['p(95)<250'], message_ack_errors: ['rate<0.01'], http_req_failed: ['rate<0.01'] },
}

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const random = Math.random() * 16 | 0; return (character === 'x' ? random : random & 0x3 | 0x8).toString(16) })
const headers = { 'Content-Type': 'application/json', Cookie: `${cookieName}=${token}` }

export function socketSession() {
  ws.connect(wsUrl, { headers: { Cookie: `${cookieName}=${token}` } }, (socket) => {
    socket.on('open', () => socket.send(JSON.stringify({ type: 'sync.resume', requestId: uuid(), cursor: null })))
    socket.setInterval(() => socket.send(JSON.stringify({ type: 'ping', requestId: uuid(), sentAt: Date.now() })), 25_000)
    socket.setTimeout(() => socket.close(), 115_000)
  })
}

export function sendMessage() {
  const started = Date.now()
  const response = http.post(`${apiUrl}/api/v1/conversations/${conversationId}/messages`, JSON.stringify({ id: uuid(), body: 'k6 production load probe' }), { headers })
  ackLatency.add(Date.now() - started); ackErrors.add(response.status !== 201)
  check(response, { 'message acknowledged': (result) => result.status === 201 })
}

export function fanoutMember() {
  ws.connect(wsUrl, { headers: { Cookie: `${cookieName}=${token}` }, tags: { scenario: '256-member-fanout' } }, (socket) => socket.setTimeout(() => socket.close(), 60_000))
}
