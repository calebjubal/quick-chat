import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, X } from 'lucide-react'
import type { WebsocketEnvelope } from '@quickchat/contracts'
import { RealtimeClient } from '../lib/realtime'
import { createIceServers } from './config'

type CallState = 'idle' | 'incoming' | 'connecting' | 'active' | 'error'
type CallSignal = { kind: 'offer'; callId: string; description: RTCSessionDescriptionInit; fromUserId: string } | { kind: 'answer'; callId: string; description: RTCSessionDescriptionInit; fromUserId: string } | { kind: 'ice'; callId: string; candidate: RTCIceCandidateInit; fromUserId: string } | { kind: 'end'; callId: string; fromUserId: string }

export function VideoCall({ conversationId, title }: { conversationId: string; title: string }) {
  const realtime = useRef<RealtimeClient | undefined>(undefined); const peer = useRef<RTCPeerConnection | undefined>(undefined); const localStream = useRef<MediaStream | undefined>(undefined); const callId = useRef<string | undefined>(undefined); const pendingOffer = useRef<(CallSignal & { kind: 'offer' }) | undefined>(undefined); const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const localVideo = useRef<HTMLVideoElement>(null); const remoteVideo = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CallState>('idle'); const stateRef = useRef<CallState>('idle'); const [message, setMessage] = useState(''); const [muted, setMuted] = useState(false); const [cameraOff, setCameraOff] = useState(false)

  const send = (type: 'call.offer' | 'call.answer' | 'call.ice' | 'call.end', payload: object) => realtime.current?.send({ type, requestId: crypto.randomUUID(), conversationId, payload }) ?? false
  const closeMedia = () => { peer.current?.close(); peer.current = undefined; localStream.current?.getTracks().forEach((track) => track.stop()); localStream.current = undefined; if (localVideo.current) localVideo.current.srcObject = null; if (remoteVideo.current) remoteVideo.current.srcObject = null; pendingIce.current = []; pendingOffer.current = undefined; callId.current = undefined; setMuted(false); setCameraOff(false) }
  const end = (notify = true) => { if (notify && callId.current) send('call.end', { kind: 'end', callId: callId.current }); closeMedia(); setState('idle'); setMessage('') }
  const endRef = useRef(end)
  useEffect(() => { endRef.current = end })

  const preparePeer = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone access is not supported on this device.')
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true } }); localStream.current = stream
    const connection = new RTCPeerConnection({ iceServers: createIceServers() }); peer.current = connection; stream.getTracks().forEach((track) => connection.addTrack(track, stream))
    connection.ontrack = (event) => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0] }
    connection.onicecandidate = (event) => { if (event.candidate && callId.current) send('call.ice', { kind: 'ice', callId: callId.current, candidate: event.candidate.toJSON() }) }
    connection.onconnectionstatechange = () => { if (connection.connectionState === 'connected') setState('active'); if (['failed', 'disconnected'].includes(connection.connectionState)) { setState('error'); setMessage('The call connection was interrupted.') } }
    if (localVideo.current) localVideo.current.srcObject = stream
    return connection
  }

  const start = async () => {
    setState('connecting'); setMessage('Calling…'); callId.current = crypto.randomUUID()
    try { const connection = await preparePeer(); const description = await connection.createOffer(); await connection.setLocalDescription(description); if (!send('call.offer', { kind: 'offer', callId: callId.current, description })) throw new Error('Call service is reconnecting. Try again shortly.') }
    catch (error) { closeMedia(); setState('error'); setMessage(error instanceof Error ? error.message : 'Unable to start the call.') }
  }
  const accept = async () => {
    const offer = pendingOffer.current; if (!offer) return
    setState('connecting'); setMessage('Connecting…'); callId.current = offer.callId
    try { const connection = await preparePeer(); await connection.setRemoteDescription(offer.description); for (const candidate of pendingIce.current) await connection.addIceCandidate(candidate); pendingIce.current = []; const answer = await connection.createAnswer(); await connection.setLocalDescription(answer); send('call.answer', { kind: 'answer', callId: offer.callId, description: answer }) }
    catch (error) { closeMedia(); setState('error'); setMessage(error instanceof Error ? error.message : 'Unable to answer the call.') }
  }

  useEffect(() => {
    const client = new RealtimeClient(); realtime.current = client
    const receive = async (event: Event) => {
      const envelope = (event as CustomEvent<WebsocketEnvelope>).detail; if (envelope.conversationId !== conversationId || !envelope.type.startsWith('call.')) return
      const signal = envelope.payload as CallSignal
      if (signal.kind === 'offer' && stateRef.current === 'idle') { pendingOffer.current = signal; callId.current = signal.callId; setState('incoming'); setMessage(`${title} is calling`) }
      else if (signal.kind === 'answer' && signal.callId === callId.current && peer.current) { await peer.current.setRemoteDescription(signal.description) }
      else if (signal.kind === 'ice' && signal.callId === callId.current) { if (peer.current?.remoteDescription) await peer.current.addIceCandidate(signal.candidate).catch(() => undefined); else pendingIce.current.push(signal.candidate) }
      else if (signal.kind === 'end' && signal.callId === callId.current) endRef.current(false)
    }
    client.addEventListener('event', receive); client.connect()
    return () => { client.removeEventListener('event', receive); client.close(); closeMedia() }
  }, [conversationId, title])
  useEffect(() => { stateRef.current = state; if (localVideo.current && localStream.current) localVideo.current.srcObject = localStream.current }, [state])

  const toggleMute = () => { const next = !muted; localStream.current?.getAudioTracks().forEach((track) => { track.enabled = !next }); setMuted(next) }
  const toggleCamera = () => { const next = !cameraOff; localStream.current?.getVideoTracks().forEach((track) => { track.enabled = !next }); setCameraOff(next) }
  return <><button className="icon-button" aria-label="Start video call" onClick={() => void start()}><Video /></button>{state !== 'idle' && <div className="call-overlay"><div className="call-stage"><video ref={remoteVideo} autoPlay playsInline /><video className="local-video" ref={localVideo} autoPlay muted playsInline /><button className="call-close" onClick={() => end()} aria-label="Close call"><X /></button><div className="call-status"><strong>{title}</strong><span>{message || (state === 'active' ? 'Connected' : 'Video call')}</span></div>{state === 'incoming' ? <div className="call-controls"><button className="accept-call" onClick={() => void accept()}><Phone /> Answer</button><button className="end-call" onClick={() => end()}><PhoneOff /> Decline</button></div> : <div className="call-controls"><button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOff /> : <Mic />}</button><button onClick={toggleCamera} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}>{cameraOff ? <VideoOff /> : <Video />}</button><button className="end-call" onClick={() => end()} aria-label="End call"><PhoneOff /></button></div>}</div></div>}</>
}
