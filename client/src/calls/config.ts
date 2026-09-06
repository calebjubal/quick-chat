import { clientEnv } from '../env'

export const createIceServers = (): RTCIceServer[] => [
  { urls: clientEnv.VITE_STUN_URL },
  ...(clientEnv.VITE_TURN_URL && clientEnv.VITE_TURN_USERNAME && clientEnv.VITE_TURN_CREDENTIAL ? [{ urls: clientEnv.VITE_TURN_URL, username: clientEnv.VITE_TURN_USERNAME, credential: clientEnv.VITE_TURN_CREDENTIAL }] : []),
]
