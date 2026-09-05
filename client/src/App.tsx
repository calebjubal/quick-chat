import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, LoaderCircle, MessageCircle, Moon, Search, Sun, Users } from 'lucide-react'
import { clientEnv } from './env'
import { applyTheme, type ThemePreference } from './theme'
import './App.css'

type SessionUser = { id: string; displayName: string; username: string }
type SessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'error'; message: string }

function Brand() {
  return <span className="brand" aria-label="Quickchat"><span className="brand-icon"><MessageCircle size={20} /></span><strong>Quickchat</strong></span>
}

function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('quickchat-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })

  useEffect(() => {
    applyTheme(preference)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => preference === 'system' && applyTheme(preference)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [preference])

  const cycle = () => {
    const next = preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system'
    localStorage.setItem('quickchat-theme', next)
    setPreference(next)
  }

  return <button className="icon-button theme-toggle" onClick={cycle} aria-label={`Theme: ${preference}. Change theme`} title={`Theme: ${preference}`}>{preference === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</button>
}

function AuthScreen() {
  return (
    <main className="auth-page">
      <div className="auth-glow" />
      <header className="public-header"><Brand /><ThemeToggle /></header>
      <section className="auth-layout">
        <div className="auth-intro">
          <span className="eyebrow">Private conversations, delivered quickly</span>
          <h1>Stay close without the noise.</h1>
          <p>Quickchat keeps conversations focused, available offline, and synchronized across your devices.</p>
          <div className="trust-row"><span><span className="status-dot" /> Live delivery</span><span>Encrypted transport</span><span>No public directory</span></div>
        </div>
        <div className="auth-card">
          <div className="auth-card-heading"><span className="mobile-brand"><Brand /></span><h2>Welcome back</h2><p>Sign in to continue to your conversations.</p></div>
          <form aria-label="Sign in" onSubmit={(event) => event.preventDefault()}>
            <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label>Password<span className="label-row"><span /><button type="button">Forgot password?</button></span><input type="password" autoComplete="current-password" placeholder="Your password" required /></label>
            <button className="primary-button" type="submit">Sign in <ArrowRight size={17} /></button>
          </form>
          <div className="auth-footer">New to Quickchat? <button type="button">Create an account</button></div>
        </div>
      </section>
    </main>
  )
}

function EmptyWorkspace({ user }: { user: SessionUser }) {
  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-top"><Brand /><ThemeToggle /></div>
        <label className="search-field"><Search size={17} /><input placeholder="Search conversations" aria-label="Search conversations" /></label>
        <div className="empty-list"><Users size={24} /><strong>No conversations yet</strong><p>Find someone by their exact username or use an invite link.</p><button className="secondary-button">Start a conversation</button></div>
        <div className="current-user"><span className="fallback-avatar">{user.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></div>
      </aside>
      <main className="empty-chat"><span className="empty-chat-icon"><MessageCircle size={29} /></span><h1>Your messages live here</h1><p>Select a conversation or start a new one. Messages will synchronize automatically when you reconnect.</p><button className="primary-button">New conversation <ArrowRight size={17} /></button></main>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })

  const loadSession = () => {
    fetch(`${clientEnv.VITE_API_URL}/api/v1/auth/session`, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401 || response.status === 404) return setSession({ status: 'unauthenticated' })
        if (!response.ok) throw new Error('The service is temporarily unavailable.')
        const data = await response.json() as { user: SessionUser }
        setSession({ status: 'authenticated', user: data.user })
      })
      .catch(() => setSession({ status: 'error', message: 'We could not reach Quickchat. Check your connection and try again.' }))
  }

  useEffect(loadSession, [])

  if (session.status === 'loading') return <main className="state-page"><Brand /><LoaderCircle className="spinner" size={27} /><p>Loading your conversations…</p></main>
  if (session.status === 'error') return <main className="state-page"><Brand /><span className="error-icon"><AlertCircle size={25} /></span><h1>Connection interrupted</h1><p>{session.message}</p><button className="secondary-button" onClick={() => { setSession({ status: 'loading' }); loadSession() }}>Try again</button></main>
  if (session.status === 'unauthenticated') return <AuthScreen />
  return <EmptyWorkspace user={session.user} />
}

export default App
