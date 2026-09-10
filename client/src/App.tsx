import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, ArrowUpRight, Check, Eye, EyeOff, Link2, LoaderCircle, LockKeyhole, Mail, MessageCircle, Monitor, Moon, Send, Sun, UserRound, Zap } from 'lucide-react'
import { clientEnv } from './env'
import { applyTheme, type ThemePreference } from './theme'
import './App.css'
import { ChatWorkspace } from './chat/ChatWorkspace'
import { apiRequest } from './chat/store'
import { useChatStore } from './chat/store'
import { clearLocalAccountData } from './offline/database'

export type SessionUser = { id: string; displayName: string; username: string | null; isGuest: boolean }
type SessionState = { status: 'loading' } | { status: 'unauthenticated' } | { status: 'authenticated'; user: SessionUser } | { status: 'error'; message: string }
type AuthMode = 'login' | 'register' | 'forgot' | 'guest' | 'reset' | 'verify' | 'resend'

function Brand() {
  return <span className="brand" aria-label="Quickchat"><span className="brand-icon"><Zap size={20} /></span><strong>Quickchat</strong></span>
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('quickchat-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })
  useEffect(() => {
    applyTheme(preference)
    const media = window.matchMedia('(prefers-color-scheme: dark)'); const update = () => preference === 'system' && applyTheme(preference)
    media.addEventListener('change', update); return () => media.removeEventListener('change', update)
  }, [preference])
  const cycle = () => { const next = preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system'; localStorage.setItem('quickchat-theme', next); setPreference(next) }
  return <button className="icon-button theme-toggle" onClick={cycle} aria-label={`Theme: ${preference}. Change theme`} title={`Theme: ${preference}`}>{preference === 'system' ? <Monitor size={18} /> : preference === 'dark' ? <Moon size={18} /> : <Sun size={18} />}<span>{preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light'}</span></button>
}

const authRequest = async <T,>(endpoint: string, body: Record<string, unknown>) => {
  const response = await fetch(`${clientEnv.VITE_API_URL}/api/v1/auth/${endpoint}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message ?? 'Request failed')
  return data as T
}

export function AuthScreen({ onAuthenticated, joinToken, initialMode = 'login' }: { onAuthenticated: (user: SessionUser, joined?: boolean) => void; joinToken?: string; initialMode?: AuthMode }) {
  const pageMode: AuthMode = location.pathname === '/reset-password' ? 'reset' : location.pathname === '/verify' ? 'verify' : joinToken ? 'guest' : initialMode
  const token = new URLSearchParams(location.search).get('token') ?? ''
  const [mode, setMode] = useState<AuthMode>(pageMode); const [message, setMessage] = useState(pageMode === 'verify' && !token ? 'Verification link is missing a token. Request a new link.' : ''); const [busy, setBusy] = useState(pageMode === 'verify' && Boolean(token))
  const verificationStarted = useRef(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (mode !== 'verify' || verificationStarted.current) return
    verificationStarted.current = true
    if (!token) return
    void authRequest<{ verified: true }>('verify', { token }).then(() => { setMessage('Email verified. You can sign in now.'); setMode('login'); history.replaceState({}, '', '/') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Verification failed')).finally(() => setBusy(false))
  }, [mode, token])

  const changeMode = (next: AuthMode) => { setMessage(''); setShowPassword(false); setMode(next) }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      if (mode === 'guest') {
        const data = await authRequest<{ user: SessionUser }>('guest', body)
        if (joinToken) {
          try { await apiRequest(`/conversations/shared/${encodeURIComponent(joinToken)}/join`, { method: 'POST', body: JSON.stringify({ displayName: body.displayName }) }); history.replaceState({}, '', '/') }
          catch { onAuthenticated(data.user, false); return }
        }
        onAuthenticated(data.user, Boolean(joinToken)); return
      }
      if (mode === 'verify') return
      const endpoint = mode === 'login' ? 'login' : mode === 'register' ? 'register' : mode === 'forgot' ? 'password/request' : mode === 'resend' ? 'verification/resend' : 'password/reset'
      const data = await authRequest<{ user?: SessionUser }>(endpoint, mode === 'reset' ? { token, password: body.password } : body)
      if (data.user) onAuthenticated(data.user)
      else if (mode === 'register') setMessage('Check your email to verify your account. Your profile will be ready after verification.')
      else if (mode === 'reset') { setMessage('Password updated. You can sign in now.'); setMode('login'); history.replaceState({}, '', '/') }
      else setMessage('If that email exists, a secure link is on its way.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed') }
    finally { setBusy(false) }
  }

  const headings: Record<AuthMode, [string, string]> = {
    login: ['Welcome back', 'Sign in to keep your chats and get higher message limits.'], register: ['Create your account', 'Keep your chats and get higher message limits.'],
    forgot: ['Reset your password', 'We will email you a secure reset link.'], guest: [joinToken ? 'Join this chat' : 'Enter Quickchat', joinToken ? 'Choose the name people in this chat will see.' : 'Pick a name and start chatting—no account needed.'],
    reset: ['Choose a new password', 'Use at least 12 characters.'], verify: ['Verifying your email', 'This will only take a moment.'],
    resend: ['Resend verification email', 'Request a fresh link if your email did not arrive or the link expired.'],
  }
  const [heading, subheading] = headings[mode]
  return <main className="auth-page">
    <div className="auth-glow" aria-hidden="true" /><header className="public-header"><Brand /><span className="header-caption">A little less setup. A lot more connection.</span><ThemeToggle /></header>
    <section className="auth-layout"><div className="auth-intro"><span className="eyebrow"><span className="status-dot" /> YOUR PEOPLE. ONE LINK AWAY.</span><h1>Skip the setup.<br /><span>Start the chat.</span></h1><p>For the quick catch-ups and the conversations that keep going. Make a link, share it, and you're in.</p><div className="intro-workflow" aria-label="How Quickchat works"><div><span className="step-icon"><Link2 /></span><small>01</small><strong>Create a link</strong><p>Your own space to talk.</p></div><ArrowRight className="step-arrow" aria-hidden="true" /><div><span className="step-icon"><Send /></span><small>02</small><strong>Send it over</strong><p>Invite someone in.</p></div><ArrowRight className="step-arrow" aria-hidden="true" /><div><span className="step-icon"><MessageCircle /></span><small>03</small><strong>Make it a chat</strong><p>Just pick a name.</p></div></div><div className="trust-row"><span><Check size={15} /> Guests welcome</span><span><LockKeyhole size={14} /> No public directory</span></div></div>
      <div className="auth-card">
        {(mode === 'login' || mode === 'register') && <div className="auth-switch" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')} disabled={busy}>Sign in</button><button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')} disabled={busy}>Create account</button></div>}
        <div className="auth-card-heading"><span className="auth-card-icon" aria-hidden="true">{mode === 'guest' ? <MessageCircle /> : mode === 'forgot' || mode === 'resend' || mode === 'verify' ? <Mail /> : <Zap />}</span><h2>{heading}</h2><p>{subheading}</p></div>
        <form aria-label={heading} onSubmit={submit} aria-busy={busy}>
          {(mode === 'register' || mode === 'guest') && <div className="auth-field"><label htmlFor="auth-name">Your name</label><div className="input-shell"><UserRound size={18} aria-hidden="true" /><input id="auth-name" name="displayName" autoComplete="name" placeholder="What should we call you?" maxLength={80} required disabled={busy} /></div></div>}
          {(mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'resend') && <div className="auth-field"><label htmlFor="auth-email">Email address</label><div className="input-shell"><Mail size={18} aria-hidden="true" /><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} /></div></div>}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && <div className="auth-field"><div className="label-row"><label htmlFor="auth-password">Password</label>{mode === 'login' && <button type="button" onClick={() => changeMode('forgot')} disabled={busy}>Forgot password?</button>}</div><div className="input-shell"><LockKeyhole size={18} aria-hidden="true" /><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} minLength={mode === 'login' ? undefined : 12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Enter your password' : 'At least 12 characters'} required disabled={busy} /><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>}
          {message && <p className="form-message" role="status">{message}</p>}
          {mode !== 'verify' && <button className="primary-button" type="submit" disabled={busy}>{busy && <LoaderCircle className="button-spinner" size={18} />}{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'guest' ? joinToken ? 'Join chat' : 'Continue as guest' : mode === 'forgot' ? 'Send reset link' : mode === 'resend' ? 'Send verification link' : 'Update password'} {!busy && <ArrowRight size={17} />}</button>}
          {mode === 'verify' && busy && <LoaderCircle className="spinner" />}
        </form>
        {(mode === 'login' || mode === 'register') && <div className="guest-entry"><span className="auth-divider">or keep it simple</span><button className="secondary-button" type="button" disabled={busy} onClick={() => changeMode('guest')}><UserRound size={17} />Continue without an account<ArrowUpRight size={17} /></button><small>Just your name. No email needed.</small></div>}
        <div className="auth-footer">{(mode === 'login' || mode === 'register' || mode === 'verify') && <button type="button" disabled={busy} onClick={() => changeMode('resend')}>Resend verification email</button>}{mode !== 'login' && mode !== 'register' && <button type="button" disabled={busy} onClick={() => changeMode('login')}>Back to sign in <ArrowRight size={14} /></button>}</div>
      </div>
    </section>
    <footer className="public-footer"><span><MessageCircle size={14} /> Less friction. More conversation.</span><span>Made for a quick hello.</span></footer>
  </main>
}

function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' }); const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [joinToken, setJoinToken] = useState(() => new URLSearchParams(location.search).get('join') ?? undefined)
  const loadSession = () => {
    fetch(`${clientEnv.VITE_API_URL}/api/v1/auth/session`, { credentials: 'include', signal: AbortSignal.timeout(10000) }).then(async (response) => {
      if (response.status === 401 || response.status === 404) { await clearLocalAccountData(); useChatStore.setState({ conversations: [], messages: {}, selectedId: undefined }); return setSession({ status: 'unauthenticated' }) }
      if (!response.ok) throw new Error('The service is temporarily unavailable.')
      const data = await response.json() as { user: SessionUser }; setSession({ status: 'authenticated', user: data.user })
    }).catch(() => setSession({ status: 'error', message: 'We could not reach Quickchat. Check your connection and try again.' }))
  }
  useEffect(loadSession, [])
  const signedOut = (nextMode: AuthMode = 'login') => { void clearLocalAccountData(); useChatStore.setState({ conversations: [], messages: {}, selectedId: undefined }); setAuthMode(nextMode); setSession({ status: 'unauthenticated' }) }
  if (session.status === 'loading') return <main className="state-page"><Brand /><LoaderCircle className="spinner" size={27} /><p>Loading your conversations…</p></main>
  if (session.status === 'error') return <main className="state-page"><Brand /><span className="error-icon"><AlertCircle size={25} /></span><h1>Connection interrupted</h1><p>{session.message}</p><button className="secondary-button" onClick={() => { setSession({ status: 'loading' }); loadSession() }}>Try again</button></main>
  if (session.status === 'unauthenticated') return <AuthScreen joinToken={joinToken} initialMode={authMode} onAuthenticated={(user, joined) => { if (joined) setJoinToken(undefined); setSession({ status: 'authenticated', user }) }} />
  return <ChatWorkspace user={session.user} joinToken={joinToken} onJoinComplete={() => { setJoinToken(undefined); history.replaceState({}, '', '/') }} onSignedOut={() => signedOut()} onRequireAccount={() => signedOut('login')} />
}

export default App
