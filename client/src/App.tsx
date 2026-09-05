import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  AtSign,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Images,
  Link2,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Pin,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Smile,
  SmilePlus,
  Sparkles,
  Users,
  Video,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import './App.css'

type Contact = {
  id: string
  name: string
  initials: string
  color: string
  preview: string
  time: string
  unread?: number
  online?: boolean
  muted?: boolean
  pinned?: boolean
}

type ChatMessage = {
  id: number
  from: 'me' | 'them'
  body: string
  time: string
  reaction?: string
  status?: 'sending' | 'sent' | 'seen'
  attachment?: 'design'
}

const contacts: Contact[] = [
  {
    id: 'omar', name: 'Omar Khalid', initials: 'OK', color: 'sunset',
    preview: 'Perfect, I’ll send the link now.', time: '11:42', unread: 2, online: true, pinned: true,
  },
  {
    id: 'maya', name: 'Maya Chen', initials: 'MC', color: 'violet',
    preview: 'The new screens look so clean!', time: '10:18', online: true, pinned: true,
  },
  {
    id: 'launch', name: 'Launch crew', initials: 'LC', color: 'lime',
    preview: 'Priya: I moved the standup to 3.', time: '09:07', unread: 5,
  },
  {
    id: 'leon', name: 'Leon Brooks', initials: 'LB', color: 'blue',
    preview: 'Voice message · 0:24', time: 'Yesterday',
  },
  {
    id: 'nora', name: 'Nora Patel', initials: 'NP', color: 'pink',
    preview: 'Let’s catch up this weekend?', time: 'Yesterday', muted: true,
  },
  {
    id: 'studio', name: 'Studio team', initials: 'ST', color: 'aqua',
    preview: 'You: Uploaded 3 files', time: 'Mon',
  },
]

const initialMessages: Record<string, ChatMessage[]> = {
  omar: [
    { id: 1, from: 'them', body: 'Hey! Do you have a minute to look at the new handoff?', time: '11:36' },
    { id: 2, from: 'me', body: 'Yep, send it over. I just wrapped up the sync flow.', time: '11:37', status: 'seen' },
    { id: 3, from: 'them', body: 'Amazing timing. The message states feel instant now.', time: '11:39', reaction: '⚡' },
    { id: 4, from: 'them', body: 'Here’s the latest design pass — focused on keeping everything calm and out of the way.', time: '11:40', attachment: 'design' },
    { id: 5, from: 'me', body: 'This is really sharp. The contrast feels much better too.', time: '11:41', status: 'seen' },
    { id: 6, from: 'them', body: 'Perfect, I’ll send the link now.', time: '11:42' },
  ],
  maya: [
    { id: 1, from: 'them', body: 'The new screens look so clean!', time: '10:18' },
    { id: 2, from: 'me', body: 'Thank you! The quieter layout makes the messages feel much faster.', time: '10:19', status: 'seen' },
  ],
  launch: [{ id: 1, from: 'them', body: 'Priya moved the standup to 3. Does that still work for you?', time: '09:07' }],
  leon: [{ id: 1, from: 'them', body: 'Voice message · 0:24', time: 'Yesterday' }],
  nora: [{ id: 1, from: 'them', body: 'Let’s catch up this weekend?', time: 'Yesterday' }],
  studio: [{ id: 1, from: 'me', body: 'Uploaded 3 files', time: 'Mon', status: 'seen' }],
}

const quickReplies = ['Looks great!', 'Send the link', 'On it — thanks!']

function Avatar({ contact, size = 'md' }: { contact: Contact; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`avatar avatar-${contact.color} avatar-${size}`} aria-hidden="true">
      {contact.initials}
      {contact.online && <span className="online-dot" />}
    </div>
  )
}

function App() {
  const [selectedId, setSelectedId] = useState('omar')
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(() => window.innerWidth > 1120)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [latency, setLatency] = useState(28)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nextMessageId = useRef(100)
  const socketRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef('')

  const selected = contacts.find((contact) => contact.id === selectedId) ?? contacts[0]
  const activeMessages = messages[selectedId] ?? []
  const filteredContacts = useMemo(
    () => contacts.filter((contact) => contact.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, selectedId])

  useEffect(() => {
    clientIdRef.current = crypto.randomUUID()
    let stopped = false
    let retryTimer = 0
    let pingTimer = 0

    const connect = () => {
      setConnectionState('connecting')
      const socket = new WebSocket(import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws')
      socketRef.current = socket

      socket.onopen = () => {
        setConnectionState('connected')
        const sendPing = () => socket.send(JSON.stringify({ type: 'ping', sentAt: Date.now() }))
        sendPing()
        pingTimer = window.setInterval(sendPing, 4000)
      }
      socket.onmessage = (event) => {
        const payload = JSON.parse(String(event.data)) as {
          type: string
          sentAt?: number
          clientId?: string
          chatId?: string
          message?: { body: string; time: string }
        }
        if (payload.type === 'pong' && payload.sentAt) {
          setLatency(Date.now() - payload.sentAt)
        }
        if (payload.type === 'message' && payload.clientId !== clientIdRef.current && payload.chatId && payload.message) {
          const incoming: ChatMessage = {
            id: ++nextMessageId.current,
            from: 'them',
            body: payload.message.body,
            time: payload.message.time,
          }
          setMessages((current) => ({
            ...current,
            [payload.chatId as string]: [...(current[payload.chatId as string] ?? []), incoming],
          }))
        }
      }
      socket.onclose = () => {
        window.clearInterval(pingTimer)
        setConnectionState('offline')
        if (!stopped) retryTimer = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      stopped = true
      window.clearInterval(pingTimer)
      window.clearTimeout(retryTimer)
      socketRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const chooseContact = (id: string) => {
    setSelectedId(id)
    setMobileListOpen(false)
  }

  const sendMessage = (preset?: string) => {
    const body = (preset ?? draft).trim()
    if (!body) return
    const id = ++nextMessageId.current
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const next: ChatMessage = { id, from: 'me', body, time: now, status: 'sending' }
    setMessages((current) => ({ ...current, [selectedId]: [...(current[selectedId] ?? []), next] }))
    setDraft('')
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'message',
        clientId: clientIdRef.current,
        chatId: selectedId,
        message: { id, body, time: now },
      }))
    }
    window.setTimeout(() => {
      setMessages((current) => ({
        ...current,
        [selectedId]: current[selectedId].map((message) =>
          message.id === id ? { ...message, status: 'sent' } : message,
        ),
      }))
    }, 220)
    window.setTimeout(() => {
      setMessages((current) => ({
        ...current,
        [selectedId]: current[selectedId].map((message) =>
          message.id === id ? { ...message, status: 'seen' } : message,
        ),
      }))
    }, 900)
  }

  const toggleReaction = (messageId: number) => {
    setMessages((current) => ({
      ...current,
      [selectedId]: current[selectedId].map((message) =>
        message.id === messageId ? { ...message, reaction: message.reaction ? undefined : '⚡' } : message,
      ),
    }))
  }

  const notify = (message: string) => setToast(message)

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Main navigation">
        <button className="brand-mark" aria-label="Quickchat home"><Zap size={19} fill="currentColor" /></button>
        <nav className="rail-nav">
          <button className="rail-button active" aria-label="Messages"><MessageCircle size={21} /></button>
          <button className="rail-button" aria-label="People" onClick={() => notify('People directory is ready')}><Users size={21} /></button>
          <button className="rail-button" aria-label="Mentions" onClick={() => notify('No new mentions')}><AtSign size={21} /></button>
          <button className="rail-button" aria-label="Archive" onClick={() => notify('Archive is empty')}><Archive size={21} /></button>
        </nav>
        <div className="rail-bottom">
          <button className="rail-button" aria-label="Settings" onClick={() => notify('Settings opened')}><Settings size={21} /></button>
          <div className="avatar avatar-teal avatar-sm">CC<span className="online-dot" /></div>
        </div>
      </aside>

      <aside className={`conversation-panel ${mobileListOpen ? 'mobile-open' : ''}`}>
        <div className="panel-heading">
          <div><span className="eyebrow">Workspace</span><button className="workspace-switcher">Arcade Studio <ChevronDown size={15} /></button></div>
          <button className="icon-button new-chat" onClick={() => setNewChatOpen(true)} aria-label="Start a new chat"><Plus size={20} /></button>
          <button className="icon-button mobile-close" onClick={() => setMobileListOpen(false)} aria-label="Close conversations"><X size={20} /></button>
        </div>
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /><span className="key-hint">⌘ K</span></label>
        <div className="inbox-label"><span>Messages</span><span>{contacts.reduce((total, contact) => total + (contact.unread ?? 0), 0)}</span></div>
        <div className="conversation-list">
          {filteredContacts.map((contact) => (
            <button className={`conversation-row ${selectedId === contact.id ? 'active' : ''}`} key={contact.id} onClick={() => chooseContact(contact.id)}>
              <Avatar contact={contact} />
              <span className="conversation-copy">
                <span className="conversation-topline"><strong>{contact.name}</strong><time>{contact.time}</time></span>
                <span className="conversation-preview"><span>{contact.preview}</span>{contact.muted && <BellOff size={13} />}{contact.unread && <b>{contact.unread}</b>}</span>
              </span>
            </button>
          ))}
          {filteredContacts.length === 0 && <div className="empty-search"><Search size={24} /><span>No conversations found</span></div>}
        </div>
        <div className={`sync-card ${connectionState}`}><span className="sync-icon"><Wifi size={15} /></span><div><strong>Live sync</strong><span>{connectionState === 'connected' ? `Connected · ${latency}ms` : connectionState === 'connecting' ? 'Connecting…' : 'Local instant mode'}</span></div><span className="pulse-dot" /></div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <button className="icon-button mobile-menu" onClick={() => setMobileListOpen(true)} aria-label="Open conversations"><Menu size={20} /></button>
          <Avatar contact={selected} />
          <button className="contact-title" onClick={() => setDetailsOpen((open) => !open)}><strong>{selected.name}</strong><span>{selected.online ? 'Online now' : 'Last active recently'}</span></button>
          <div className="chat-actions">
            <button className="icon-button" onClick={() => notify(`Calling ${selected.name}…`)} aria-label="Start audio call"><Phone size={19} /></button>
            <button className="icon-button" onClick={() => notify(`Starting video with ${selected.name}…`)} aria-label="Start video call"><Video size={20} /></button>
            <button className="icon-button" onClick={() => setDetailsOpen((open) => !open)} aria-label="Conversation details"><MoreHorizontal size={21} /></button>
          </div>
        </header>

        <section className="message-area" aria-live="polite">
          <div className="conversation-intro"><Avatar contact={selected} size="lg" /><h1>{selected.name}</h1><p>{selected.online ? 'You’re connected in real time.' : 'Messages will sync when they return.'}</p></div>
          <div className="date-divider"><span>Today</span></div>
          {activeMessages.map((message, index) => {
            const previous = activeMessages[index - 1]
            const compact = previous?.from === message.from
            return (
              <div className={`message-line ${message.from} ${compact ? 'compact' : ''}`} key={message.id}>
                {message.from === 'them' && !compact ? <Avatar contact={selected} size="sm" /> : <span className="avatar-spacer" />}
                <div className="message-stack">
                  <div className="bubble-row">
                    <div className="message-bubble">
                      <p>{message.body}</p>
                      {message.attachment === 'design' && (
                        <button className="design-preview" onClick={() => notify('Design preview opened')}>
                          <span className="design-sidebar"><i /><i /><i /></span><span className="design-canvas"><i /><i /><i /></span><span className="design-label"><Sparkles size={13} /> Design preview</span>
                        </button>
                      )}
                    </div>
                    <button className="reaction-trigger" onClick={() => toggleReaction(message.id)} aria-label="React to message"><SmilePlus size={15} /></button>
                  </div>
                  <div className="message-meta">
                    <time>{message.time}</time>
                    {message.from === 'me' && (message.status === 'sending' ? <span>Sending…</span> : <CheckCheck size={14} className={message.status === 'seen' ? 'seen' : ''} />)}
                    {message.reaction && <button className="reaction-pill" onClick={() => toggleReaction(message.id)}>{message.reaction} <span>1</span></button>}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </section>

        <footer className="composer-wrap">
          <div className="quick-replies">{quickReplies.map((reply) => <button key={reply} onClick={() => sendMessage(reply)}>{reply}</button>)}</div>
          <div className={`composer ${draft ? 'has-text' : ''}`}>
            <input ref={fileRef} type="file" hidden onChange={(event) => event.target.files?.[0] && notify(`${event.target.files[0].name} attached`)} />
            <button className="composer-button" onClick={() => fileRef.current?.click()} aria-label="Attach a file"><Paperclip size={20} /></button>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} rows={1} placeholder={`Message ${selected.name.split(' ')[0]}`} />
            <button className="composer-button emoji" onClick={() => setDraft((value) => `${value} ✨`)} aria-label="Add emoji"><Smile size={20} /></button>
            {draft ? <button className="send-button" onClick={() => sendMessage()} aria-label="Send message"><SendHorizontal size={18} /></button> : <button className={`composer-button ${isRecording ? 'recording' : ''}`} onClick={() => setIsRecording((value) => !value)} aria-label="Record voice message"><Mic size={20} /></button>}
          </div>
          <div className="composer-note"><Zap size={11} fill="currentColor" /> Instant send · Enter to send</div>
        </footer>
      </main>

      <aside className={`details-panel ${detailsOpen ? 'open' : ''}`}>
        <button className="icon-button details-close" onClick={() => setDetailsOpen(false)} aria-label="Close details"><X size={19} /></button>
        <div className="profile-card">
          <Avatar contact={selected} size="lg" /><h2>{selected.name}</h2><span>{selected.online ? 'Online' : 'Away'}</span>
          <div className="profile-actions">
            <button onClick={() => notify(`Calling ${selected.name}…`)}><Phone size={17} /><span>Audio</span></button>
            <button onClick={() => notify(`Starting video with ${selected.name}…`)}><Video size={18} /><span>Video</span></button>
            <button onClick={() => notify('Notifications muted')}><BellOff size={17} /><span>Mute</span></button>
          </div>
        </div>
        <div className="detail-section"><button><span><Images size={17} /> Media, links & docs</span><span className="detail-count">24</span><ChevronRight size={17} /></button><div className="media-strip"><span /><span /><span><Image size={17} /></span></div></div>
        <div className="detail-section detail-links">
          <button onClick={() => notify('Pinned messages opened')}><span><Pin size={17} /> Pinned messages</span><span className="detail-count">3</span><ChevronRight size={17} /></button>
          <button onClick={() => notify('Shared files opened')}><span><FileText size={17} /> Shared files</span><span className="detail-count">8</span><ChevronRight size={17} /></button>
          <button onClick={() => notify('Shared links opened')}><span><Link2 size={17} /> Shared links</span><span className="detail-count">13</span><ChevronRight size={17} /></button>
        </div>
        <button className="view-profile" onClick={() => notify('Full profile opened')}>View full profile</button>
      </aside>

      {newChatOpen && (
        <div className="modal-backdrop" onMouseDown={() => setNewChatOpen(false)}>
          <div className="new-chat-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">New message</span><h2>Who do you want to chat with?</h2></div><button className="icon-button" onClick={() => setNewChatOpen(false)}><X size={20} /></button></div>
            <label className="search-box"><Search size={17} /><input autoFocus placeholder="Search people" /></label>
            <div className="people-list">{contacts.slice(1, 5).map((contact) => <button key={contact.id} onClick={() => { chooseContact(contact.id); setNewChatOpen(false) }}><Avatar contact={contact} /><span><strong>{contact.name}</strong><small>{contact.online ? 'Online now' : 'Available on Quickchat'}</small></span><ChevronRight size={17} /></button>)}</div>
          </div>
        </div>
      )}
      {isRecording && <div className="recording-toast"><span /> Recording voice message <button onClick={() => setIsRecording(false)}>Cancel</button></div>}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  )
}

export default App
