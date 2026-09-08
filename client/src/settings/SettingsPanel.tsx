import { useEffect, useState, type FormEvent } from 'react'
import { LogOut, MonitorSmartphone, X } from 'lucide-react'
import { clientEnv } from '../env'
import { clearLocalAccountData } from '../offline/database'
import { applyTheme, type ThemePreference } from '../theme'

type DeviceSession = { id: string; device: string; current: boolean; lastSeenAt: string }
type Settings = { theme: ThemePreference; readReceiptsEnabled: boolean; lastSeenVisibility: 'everyone' | 'contacts' | 'nobody' }

const api = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${clientEnv.VITE_API_URL}/api/v1${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'Request failed')
  return data
}

export function SettingsPanel({ onClose, onSignedOut }: { onClose: () => void; onSignedOut: () => void }) {
  const [settings, setSettings] = useState<Settings>(); const [sessions, setSessions] = useState<DeviceSession[]>([]); const [message, setMessage] = useState('')
  useEffect(() => { Promise.all([api('/me/settings'), api('/sessions')]).then(([settingsData, sessionData]) => { setSettings(settingsData.settings); setSessions(sessionData.sessions) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load settings')) }, [])
  const update = async (patch: Partial<Settings>) => { try { const data = await api('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }); setSettings(data.settings); if (patch.theme) { localStorage.setItem('quickchat-theme', patch.theme); applyTheme(patch.theme) } } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings') } }
  const logout = async () => { await fetch(`${clientEnv.VITE_API_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }); await clearLocalAccountData(); onSignedOut() }
  const changePassword = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) }); event.currentTarget.reset(); setMessage('Password changed. Other devices were signed out.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to change password') } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="settings-dialog" onMouseDown={(event) => event.stopPropagation()} aria-label="Settings"><header><div><small>Account</small><h2>Settings</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
    {!settings ? <p>{message || 'Loading settings…'}</p> : <>
      <section><h3>Appearance & privacy</h3><label>Theme<select value={settings.theme} onChange={(event) => void update({ theme: event.target.value as ThemePreference })}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label></section>
      <section><h3>Active devices</h3>{sessions.map((session) => <div className="device-row" key={session.id}><MonitorSmartphone /><span><strong>{session.device}{session.current ? ' · This device' : ''}</strong><small>{new Date(session.lastSeenAt).toLocaleString()}</small></span>{!session.current && <button onClick={() => void api(`/sessions/${session.id}`, { method: 'DELETE' }).then(() => setSessions((items) => items.filter((item) => item.id !== session.id)))}>Sign out</button>}</div>)}</section>
      <section><h3>Change password</h3><form className="settings-form" onSubmit={changePassword}><input name="currentPassword" type="password" placeholder="Current password" required /><input name="newPassword" type="password" minLength={12} maxLength={128} placeholder="New password" required /><button className="secondary-button">Update password</button></form></section>
      <section className="settings-actions"><button className="secondary-button" onClick={() => void logout()}><LogOut /> Sign out</button></section>
      {message && <p role="status" className="settings-message">{message}</p>}
    </>}
  </section></div>
}
