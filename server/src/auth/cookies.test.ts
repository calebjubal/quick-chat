import { expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
vi.mock('../env.js', () => ({ env: { NODE_ENV: 'production', COOKIE_SAME_SITE: 'Lax', SESSION_TTL_DAYS: 30 } }))
import { cookieOptions } from './cookies.js'

it('sets and expires valid secure host-prefixed cookies', async () => {
  const app = new Hono().get('/set', (c) => { setCookie(c, '__Host-quickchat_session', 'opaque', cookieOptions); return c.text('ok') }).get('/clear', (c) => { deleteCookie(c, '__Host-quickchat_session', cookieOptions); return c.text('ok') })
  for (const path of ['/set', '/clear']) {
    const cookie = (await app.request(path)).headers.get('set-cookie')!
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/')
    expect(cookie).not.toContain('Domain=')
    if (path === '/clear') expect(cookie).toContain('Max-Age=0')
  }
})
