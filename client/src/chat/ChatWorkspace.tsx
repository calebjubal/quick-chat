import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Archive, Bell, BellOff, Copy, FileText, Link2, LockKeyhole, Menu, MessageCircle, Mic, Paperclip, Pin, Plus, Search, Send, Settings, Share2, Trash2, Users, Video, X, Zap } from 'lucide-react'
import type { WebsocketEnvelope } from '@quickchat/contracts'
import type { SessionUser } from '../App'
import { enablePushNotifications, updateNotificationFocus } from '../notifications'
import { clearLocalAccountData } from '../offline/database'
import { SettingsPanel } from '../settings/SettingsPanel'
import { VideoCall } from '../calls/VideoCall'
import { RealtimeClient } from '../lib/realtime'
import { MAX_VOICE_SECONDS, VoiceRecorder, formatVoiceDuration } from '../voice/recorder'
import { apiRequest, useChatStore, type Attachment, type ConversationEntry } from './store'
import { openAttachment, uploadAttachment } from './uploads'

type Props = { user: SessionUser; joinToken?: string; onJoinComplete: () => void; onSignedOut: () => void; onRequireAccount: () => void }
type InboxTab = 'created' | 'sent'

const titleFor = (entry: ConversationEntry) => entry.conversation.title ?? (entry.participants.map((item) => item.displayName).join(', ') || 'Private chat')
const initials = (value: string) => value.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'

function AttachmentView({ attachment }: { attachment: Attachment }) {
  const [audioUrl, setAudioUrl] = useState<string>(); const [error, setError] = useState('')
  const open = async () => { try { await openAttachment(attachment.id) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Attachment unavailable') } }
  const play = async () => {
    try { const { url } = await apiRequest<{ url: string }>(`/uploads/${attachment.id}/download`); setAudioUrl(url) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Voice note unavailable') }
  }
  if (attachment.kind === 'voice' || attachment.kind === 'audio') return <div className="attachment-card">{audioUrl ? <audio controls autoPlay preload="metadata" src={audioUrl} /> : <button type="button" onClick={() => void play()}><Mic size={16} /> Play {attachment.kind === 'voice' ? 'voice note' : 'audio'}</button>}{error && <small>{error}</small>}</div>
  return <div className="attachment-card"><button type="button" onClick={() => void open()}><FileText size={17} /><span>{attachment.fileName}</span></button>{error && <small>{error}</small>}</div>
}

function ShareDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(url); setCopied(true) }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="find-dialog share-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><small>Invite link</small><h2>Share this chat</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header><p>Anyone with this link can join and choose the name shown in this chat. The link expires in seven days.</p><div className="share-link"><input readOnly value={url} aria-label="Chat invite link" /><button className="icon-button" onClick={() => void copy()} aria-label="Copy invite link"><Copy /></button></div><button className="primary-button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</button></section></div>
}

function UpgradeDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [complete, setComplete] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(''); const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try { await apiRequest('/auth/guest/upgrade', { method: 'POST', body: JSON.stringify(body) }); setComplete(true) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create account') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="find-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><small>Keep every chat</small><h2>{complete ? 'Check your email' : 'Unlock the full app'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>{complete ? <><p>Your chats are saved to the new account. Verify your email, then sign in.</p><button type="button" className="primary-button" onClick={onComplete}>Go to sign in</button></> : <><p>Create an account to send files, start video calls, and raise your daily limits.</p><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="At least 12 characters" required /></label>{message && <p role="alert">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button></>}</form></div>
}

export function ChatWorkspace({ user, joinToken, onJoinComplete, onSignedOut, onRequireAccount }: Props) {
  const store = useChatStore(); const fileInput = useRef<HTMLInputElement>(null); const recorder = useRef(new VoiceRecorder()); const recordTimer = useRef<number | undefined>(undefined); const recordingActive = useRef(false); const recordingStartedAt = useRef(0)
  const [draft, setDraft] = useState(''); const [query, setQuery] = useState(''); const [tab, setTab] = useState<InboxTab>('created'); const [drawer, setDrawer] = useState(false)
  const [createOpen, setCreateOpen] = useState(false); const [findOpen, setFindOpen] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(Boolean(joinToken)); const [shareUrl, setShareUrl] = useState(''); const [dialogError, setDialogError] = useState(''); const [notice, setNotice] = useState('')
  const [recording, setRecording] = useState(false); const [recordedSeconds, setRecordedSeconds] = useState(0); const [uploading, setUploading] = useState(false); const [uploadProgress, setUploadProgress] = useState(0)
  const loadConversations = store.loadConversations

  useEffect(() => { void loadConversations() }, [loadConversations])
  useEffect(() => {
    const realtime = new RealtimeClient()
    const receive = (event: Event) => { const envelope = (event as CustomEvent<WebsocketEnvelope>).detail; const conversationId = envelope.conversationId; if (envelope.type.startsWith('message.') || envelope.type.startsWith('conversation.')) { void loadConversations(); if (conversationId && conversationId === useChatStore.getState().selectedId) void useChatStore.getState().select(conversationId, true) } }
    realtime.addEventListener('event', receive); realtime.connect(); return () => { realtime.removeEventListener('event', receive); realtime.close() }
  }, [loadConversations])
  useEffect(() => {
    const focused = document.visibilityState === 'visible' ? store.selectedId ?? null : null
    void updateNotificationFocus(focused).catch(() => undefined)
    const refresh = () => void updateNotificationFocus(document.visibilityState === 'visible' ? store.selectedId ?? null : null).catch(() => undefined)
    const receive = (event: MessageEvent<{ type?: string; payload?: { title?: string } }>) => { if (event.data?.type === 'quickchat:push') setNotice(`${event.data.payload?.title ?? 'Quickchat'} sent a new message`) }
    document.addEventListener('visibilitychange', refresh); navigator.serviceWorker?.addEventListener('message', receive)
    return () => { document.removeEventListener('visibilitychange', refresh); navigator.serviceWorker?.removeEventListener('message', receive); void updateNotificationFocus(null).catch(() => undefined) }
  }, [store.selectedId])
  useEffect(() => () => { if (recordTimer.current) window.clearInterval(recordTimer.current); recorder.current.cancel() }, [])

  const selected = store.conversations.find((entry) => entry.conversation.id === store.selectedId)
  const createdCount = store.conversations.filter((entry) => entry.direction === 'created' && entry.conversation.type === 'shared').length
  const visible = useMemo(() => store.conversations.filter((entry) => entry.direction === tab && !entry.membership.archivedAt && titleFor(entry).toLowerCase().includes(query.toLowerCase())), [store.conversations, query, tab])
  const messages = store.selectedId ? store.messages[store.selectedId] ?? [] : []
  const canVideoCall = Boolean(!user.isGuest && selected && selected.participants.length === 1 && (selected.conversation.type === 'direct' || selected.conversation.type === 'shared'))

  const sendText = (event: FormEvent) => { event.preventDefault(); if (draft.trim()) { void store.send(user.id, { body: draft }); setDraft('') } }
  const createChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setDialogError(''); const title = String(new FormData(event.currentTarget).get('title') ?? '')
    try { const result = await store.createShared(title); setCreateOpen(false); setShareUrl(result.shareUrl); setTab('created') }
    catch (error) { setDialogError(error instanceof Error ? error.message : 'Unable to create chat') }
  }
  const joinChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!joinToken) return; setDialogError(''); const displayName = String(new FormData(event.currentTarget).get('displayName') ?? '')
    try { await store.joinShared(joinToken, displayName); setJoinOpen(false); setTab('sent'); onJoinComplete() }
    catch (error) { setDialogError(error instanceof Error ? error.message : 'Unable to join chat') }
  }
  const startDirect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setDialogError(''); const username = String(new FormData(event.currentTarget).get('username') ?? '')
    try { const found = await apiRequest<{ user: { id: string } }>(`/users/lookup?username=${encodeURIComponent(username)}`); await apiRequest('/conversations/direct', { method: 'POST', body: JSON.stringify({ userId: found.user.id }) }); setFindOpen(false); setTab('created'); await store.loadConversations() }
    catch (error) { setDialogError(error instanceof Error ? error.message : 'User not found') }
  }
  const shareSelected = async () => { if (!selected) return; try { setShareUrl(await store.share(selected.conversation.id)) } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to share chat') } }
  const signOut = async () => { await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined); await clearLocalAccountData(); useChatStore.setState({ conversations: [], messages: {}, selectedId: undefined }); onSignedOut() }

  const startVoice = async () => {
    setDialogError('')
    try { await recorder.current.start(); recordingActive.current = true; recordingStartedAt.current = Date.now(); setRecordedSeconds(0); setRecording(true); recordTimer.current = window.setInterval(() => setRecordedSeconds((value) => { if (value + 1 >= MAX_VOICE_SECONDS) void finishVoice(); return Math.min(value + 1, MAX_VOICE_SECONDS) }), 1000) }
    catch { setNotice('Microphone permission is needed to record a voice note.') }
  }
  const cancelVoice = () => { recordingActive.current = false; recorder.current.cancel(); if (recordTimer.current) window.clearInterval(recordTimer.current); setRecording(false); setRecordedSeconds(0) }
  const finishVoice = async () => {
    if (!recordingActive.current) return; recordingActive.current = false; if (recordTimer.current) window.clearInterval(recordTimer.current); setRecording(false); setUploading(true); setUploadProgress(0)
    try { const durationSeconds = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round((Date.now() - recordingStartedAt.current) / 1000))); const blob = await recorder.current.stop(); const attachment = await uploadAttachment(blob, `voice-${Date.now()}.webm`, { voice: true, durationSeconds, onProgress: setUploadProgress }); await store.send(user.id, { attachmentId: attachment.id }) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to send voice note') }
    finally { setUploading(false); setRecordedSeconds(0) }
  }
  const chooseFile = () => user.isGuest ? setUpgradeOpen(true) : fileInput.current?.click()
  const sendFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setUploading(true); setUploadProgress(0)
    try { const attachment = await uploadAttachment(file, file.name, { onProgress: setUploadProgress }); await store.send(user.id, { attachmentId: attachment.id }) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to send file') }
    finally { setUploading(false) }
  }
  const closeSelected = async () => { if (!selected || !window.confirm('Close this chat? Its invite links will stop working and it will disappear for everyone.')) return; try { await store.close(selected.conversation.id); setNotice('Chat closed') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to close chat') } }

  return <div className="chat-workspace">
    <nav className="chat-rail" aria-label="Application"><span className="brand-icon"><Zap size={20} /></span><button aria-label="Messages"><MessageCircle /></button><button aria-label="Enable notifications" onClick={() => void enablePushNotifications().then(() => setNotice('Notifications enabled')).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Unable to enable notifications'))}><Bell /></button><button aria-label={user.isGuest ? 'Create an account' : 'Settings'} onClick={() => user.isGuest ? setUpgradeOpen(true) : setSettingsOpen(true)}>{user.isGuest ? <LockKeyhole /> : <Settings />}</button><button className="rail-avatar" aria-label="Account" onClick={() => user.isGuest ? setUpgradeOpen(true) : setSettingsOpen(true)}><span className="fallback-avatar">{initials(user.displayName)}</span></button></nav>
    <aside className={`inbox ${drawer ? 'open' : ''}`}><header><div><small>{user.isGuest ? 'Guest profile' : 'Quickchat'}</small><h1>Chats</h1></div><button className="icon-button" onClick={() => setCreateOpen(true)} aria-label="Create shareable chat"><Plus /></button><button className="icon-button inbox-close" onClick={() => setDrawer(false)} aria-label="Close chat list"><X /></button></header>
      <div className="inbox-tabs" role="tablist"><button className={tab === 'created' ? 'active' : ''} onClick={() => setTab('created')} role="tab" aria-selected={tab === 'created'}>Created by you <span>{createdCount}/5</span></button><button className={tab === 'sent' ? 'active' : ''} onClick={() => setTab('sent')} role="tab" aria-selected={tab === 'sent'}>Sent to you</button></div>
      <label className="search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" /></label>
      <div className="conversation-list">{store.loading && <p className="list-state">Loading chats…</p>}{!store.loading && !visible.length && <div className="list-empty"><Users /><strong>{tab === 'created' ? 'No chats created yet' : 'No chats sent to you'}</strong><p>{tab === 'created' ? 'Create a chat and share its private link.' : 'Chats you join from an invite link appear here.'}</p>{tab === 'created' && <button className="secondary-button" onClick={() => setCreateOpen(true)}>Create a chat</button>}</div>}{visible.map((entry) => <button className={`conversation-item ${store.selectedId === entry.conversation.id ? 'active' : ''}`} key={entry.conversation.id} onClick={() => { void store.select(entry.conversation.id); setDrawer(false) }}><span className="fallback-avatar">{initials(titleFor(entry))}</span><span><strong>{titleFor(entry)}</strong><small>{entry.participants.length ? `${entry.participants.length} other ${entry.participants.length === 1 ? 'person' : 'people'}` : 'Waiting for someone to join'}</small></span>{entry.membership.pinnedAt && <Pin size={13} />}</button>)}</div>
      <footer className="usage-card"><strong>{user.isGuest ? 'Guest limits' : 'Account limits'}</strong><span>{user.isGuest ? '50 messages · 10 voice notes daily' : '1,000 messages · 100 files daily'}</span>{user.isGuest && <button onClick={() => setUpgradeOpen(true)}>Unlock files and video</button>}<button onClick={() => void signOut()}>Sign out</button></footer>
    </aside>
    <main className="conversation-view">{selected ? <><header><button className="icon-button mobile-inbox" onClick={() => setDrawer(true)} aria-label="Open chat list"><Menu /></button><span className="fallback-avatar">{initials(titleFor(selected))}</span><div><strong>{titleFor(selected)}</strong><small>{selected.conversation.type === 'shared' ? 'Shared private chat' : selected.conversation.type === 'group' ? 'Group conversation' : 'Direct conversation'}</small></div><span className="header-spacer" />{selected.direction === 'created' && selected.conversation.type === 'shared' && <button className="icon-button" onClick={() => void shareSelected()} aria-label="Share chat"><Share2 /></button>}{canVideoCall ? <VideoCall conversationId={selected.conversation.id} title={titleFor(selected)} /> : user.isGuest && <button className="icon-button locked-action" onClick={() => setUpgradeOpen(true)} aria-label="Create an account for video calls"><Video /><LockKeyhole size={10} /></button>}<button className="icon-button mobile-account" onClick={() => user.isGuest ? setUpgradeOpen(true) : setSettingsOpen(true)} aria-label="Account settings"><Settings /></button><button className="icon-button" onClick={() => void store.setInbox(selected.conversation.id, { pinned: !selected.membership.pinnedAt })} aria-label="Pin chat"><Pin /></button><button className="icon-button" onClick={() => void store.setInbox(selected.conversation.id, { mutedUntil: selected.membership.mutedUntil ? null : new Date(Date.now() + 8 * 3600000).toISOString() })} aria-label="Mute chat"><BellOff /></button><button className="icon-button" onClick={() => void store.setInbox(selected.conversation.id, { archived: true })} aria-label="Archive chat"><Archive /></button>{selected.direction === 'created' && selected.conversation.type === 'shared' && <button className="icon-button close-chat" onClick={() => void closeSelected()} aria-label="Close chat"><Trash2 /></button>}</header>
        <section className="message-list" aria-live="polite">{!messages.length && <div className="conversation-empty"><MessageCircle /><strong>No messages yet</strong><p>Say hello or tap the microphone to record a voice note.</p></div>}{messages.map((message) => <article className={message.senderId === user.id ? 'mine' : ''} key={message.id}>{message.deletedForEveryoneAt ? <p className="deleted-message">This message was deleted</p> : <>{message.body && <p>{message.body}</p>}{message.attachment && <AttachmentView attachment={message.attachment} />}</>}<time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{message.editedAt ? ' · edited' : ''}</time></article>)}</section>
        {recording ? <div className="recording-composer"><span className="recording-dot" /><strong>{formatVoiceDuration(recordedSeconds)}</strong><span>Recording voice note</span><button onClick={cancelVoice} aria-label="Cancel recording"><X /></button><button className="record-send" onClick={() => void finishVoice()} aria-label="Send voice note"><Send /></button></div> : <form className="message-composer" onSubmit={sendText}><input ref={fileInput} className="file-input" type="file" onChange={(event) => void sendFile(event)} accept="image/*,video/*,audio/*,.pdf,.docx,.xlsx,.pptx,.txt,.csv" /><button type="button" aria-label={user.isGuest ? 'Create an account to attach files' : 'Attach file'} onClick={chooseFile} className={user.isGuest ? 'locked-action' : ''}><Paperclip />{user.isGuest && <LockKeyhole size={9} />}</button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={uploading ? `Checking upload${uploadProgress ? ` · ${uploadProgress}%` : '…'}` : 'Write a message'} maxLength={4000} disabled={uploading} /><button type="button" aria-label="Record voice note" onClick={() => void startVoice()} disabled={uploading}><Mic /></button><button type="submit" aria-label="Send" disabled={uploading || !draft.trim()}><Send /></button></form>}</> : <div className="empty-chat"><span className="empty-chat-icon"><Link2 /></span><h1>Create, share, chat.</h1><p>Make a private chat link for someone, or open a chat that was sent to you. Keep every conversation in one place.</p><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Create chat</button>{!user.isGuest && <button className="text-button" onClick={() => setFindOpen(true)}>Or find an account by username</button>}</div>}</main>

    {createOpen && <div className="modal-backdrop" onMouseDown={() => setCreateOpen(false)}><form className="find-dialog" onSubmit={createChat} onMouseDown={(event) => event.stopPropagation()}><header><div><small>{createdCount} of 5 used</small><h2>Create a chat</h2></div><button type="button" className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Close"><X /></button></header><p>Name the chat, then send its private invite link to anyone.</p><label>Chat name<input name="title" autoFocus maxLength={120} placeholder={`${user.displayName}'s chat`} /></label>{dialogError && <p role="alert">{dialogError}</p>}<button className="primary-button" disabled={createdCount >= 5}>Create and get link</button></form></div>}
    {findOpen && <div className="modal-backdrop" onMouseDown={() => setFindOpen(false)}><form className="find-dialog" onSubmit={startDirect} onMouseDown={(event) => event.stopPropagation()}><header><div><small>New direct chat</small><h2>Find by username</h2></div><button type="button" className="icon-button" onClick={() => setFindOpen(false)} aria-label="Close"><X /></button></header><label>Exact username<input name="username" autoFocus pattern="[A-Za-z0-9_]{3,32}" placeholder="exact_username" required /></label>{dialogError && <p role="alert">{dialogError}</p>}<button className="primary-button">Start conversation</button></form></div>}
    {joinOpen && joinToken && <div className="modal-backdrop"><form className="find-dialog" onSubmit={joinChat}><header><div><small>Chat invitation</small><h2>What should we call you?</h2></div></header><p>This name is shown to people in this chat.</p><label>Your name<input name="displayName" autoFocus defaultValue={user.displayName} maxLength={80} required /></label>{dialogError && <p role="alert">{dialogError}</p>}<button className="primary-button">Join chat</button></form></div>}
    {shareUrl && <ShareDialog url={shareUrl} onClose={() => setShareUrl('')} />}
    {upgradeOpen && <UpgradeDialog onClose={() => setUpgradeOpen(false)} onComplete={onRequireAccount} />}
    {settingsOpen && !user.isGuest && <SettingsPanel onClose={() => setSettingsOpen(false)} onSignedOut={onSignedOut} />}
    {store.error && <div className="app-toast">{store.error}<button onClick={() => useChatStore.setState({ error: undefined })}>Dismiss</button></div>}
    {notice && <div className="app-toast" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
  </div>
}
