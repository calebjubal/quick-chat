import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, LoaderCircle, Moon, Sun, Zap } from 'lucide-react'
import { clientEnv } from './env'
import { applyTheme, type ThemePreference } from './theme'
import './App.css'
import { ChatWorkspace } from './chat/ChatWorkspace'
import { apiRequest } from './chat/store'
import { useChatStore } from './chat/store'
import { clearLocalAccountData } from './offline/database'

export type SessionUser = { id: string; displayName: string; username: string | null; isGuest: boolean }
type SessionState = { status: 'loading' } | { status: 'unauthenticated' } | { status: 'authenticated'; user: SessionUser } | { status: 'error'; message: string }
type AuthMode = 'login' | 'register' | 'forgot' | 'guest' | 'reset' | 'verify'

function Brand() {
  return <span className="brand" aria-label="Quickchat"><span className="brand-icon"><Zap size={20} /></span><strong>Quickchat</strong></span>
}

function ThemeToggle() {
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
  return <button className="icon-button theme-toggle" onClick={cycle} aria-label={`Theme: ${preference}. Change theme`} title={`Theme: ${preference}`}>{preference === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</button>
}

const authRequest = async <T,>(endpoint: string, body: Record<string, unknown>) => {
  const response = await fetch(`${clientEnv.VITE_API_URL}/api/v1/auth/${endpoint}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message ?? 'Request failed')
  return data as T
}

function AuthScreen({ onAuthenticated, joinToken, initialMode = 'login' }: { onAuthenticated: (user: SessionUser, joined?: boolean) => void; joinToken?: string; initialMode?: AuthMode }) {
  const pageMode: AuthMode = location.pathname === '/reset-password' ? 'reset' : location.pathname === '/verify' ? 'verify' : joinToken ? 'guest' : initialMode
  const [mode, setMode] = useState<AuthMode>(pageMode); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(pageMode === 'verify')
  const token = new URLSearchParams(location.search).get('token') ?? ''

  useEffect(() => {
    if (mode !== 'verify' || !token) return
    void authRequest<{ verified: true }>('verify', { token }).then(() => { setMessage('Email verified. You can sign in now.'); setMode('login'); history.replaceState({}, '', '/') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Verification failed')).finally(() => setBusy(false))
  }, [mode, token])

  const changeMode = (next: AuthMode) => { setMessage(''); setMode(next) }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      if (mode === 'guest') {
        const data = await authRequest<{ user: SessionUser }>('guest', body)
        if (joinToken) { await apiRequest(`/conversations/shared/${encodeURIComponent(joinToken)}/join`, { method: 'POST', body: JSON.stringify({ displayName: body.displayName }) }); history.replaceState({}, '', '/') }
        onAuthenticated(data.user, Boolean(joinToken)); return
      }
      if (mode === 'verify') return
      const endpoint = mode === 'login' ? 'login' : mode === 'register' ? 'register' : mode === 'forgot' ? 'password/request' : 'password/reset'
      const data = await authRequest<{ user?: SessionUser }>(endpoint, mode === 'reset' ? { token, password: body.password } : body)
      if (data.user) onAuthenticated(data.user)
      else if (mode === 'register') setMessage('Check your email to verify your account. Your profile will be ready after verification.')
      else if (mode === 'reset') { setMessage('Password updated. You can sign in now.'); setMode('login'); history.replaceState({}, '', '/') }
      else setMessage('If that email exists, a secure link is on its way.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed') }
    finally { setBusy(false) }
  }

  const headings: Record<AuthMode, [string, string]> = {
    login: ['Welcome back', 'Sign in for files, video calls, and higher limits.'], register: ['Create your account', 'Keep your chats and unlock files and video calls.'],
    forgot: ['Reset your password', 'We will email you a secure reset link.'], guest: [joinToken ? 'Join this chat' : 'Enter Quickchat', joinToken ? 'Choose the name people in this chat will see.' : 'Pick a name and start chatting—no account needed.'],
    reset: ['Choose a new password', 'Use at least 12 characters.'], verify: ['Verifying your email', 'This will only take a moment.'],
  }
  const [heading, subheading] = headings[mode]
  return <main className="auth-page">
    <div className="auth-glow" /><header className="public-header"><Brand /><ThemeToggle /></header>
    <section className="auth-layout"><div className="auth-intro"><span className="eyebrow">Fast conversations, zero setup</span><h1>Share a chat.<br />Talk instantly.</h1><p>Create a private chat link, send it to anyone, and start talking as soon as they choose a name.</p><div className="trust-row"><span><span className="status-dot" /> Live delivery</span><span>Voice notes for guests</span><span>No public directory</span></div></div>
      <div className="auth-card"><div className="auth-card-heading"><span className="mobile-brand"><Brand /></span><h2>{heading}</h2><p>{subheading}</p></div>
        <form aria-label={heading} onSubmit={submit}>
          {(mode === 'register' || mode === 'guest') && <label>Your name<input name="displayName" autoComplete="name" placeholder="How people should see you" required autoFocus /></label>}
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && <label>Password<span className="label-row"><span />{mode === 'login' && <button type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>}</span><input name="password" type="password" minLength={12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 12 characters" required /></label>}
          {message && <p className="form-message" role="status">{message}</p>}
          {mode !== 'verify' && <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'guest' ? joinToken ? 'Join chat' : 'Continue as guest' : mode === 'forgot' ? 'Send reset link' : 'Update password'} {!busy && <ArrowRight size={17} />}</button>}
          {mode === 'verify' && busy && <LoaderCircle className="spinner" />}
        </form>
        <div className="auth-footer">{mode === 'login' ? <><button type="button" onClick={() => changeMode('guest')}>Continue without an account</button><span className="auth-divider">or</span><button type="button" onClick={() => changeMode('register')}>Create an account</button></> : <button type="button" onClick={() => changeMode('login')}>Sign in instead</button>}</div>
      </div>
    </section>
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
