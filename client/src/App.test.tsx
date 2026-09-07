// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthScreen } from './App'

beforeEach(() => {
  history.replaceState({}, '', '/')
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('consumes a verification link only once in StrictMode', async () => {
  history.replaceState({}, '', '/verify?token=one-use-verification-token')
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ verified: true }) })
  vi.stubGlobal('fetch', fetcher)
  render(<StrictMode><AuthScreen onAuthenticated={vi.fn()} /></StrictMode>)
  await screen.findByText('Email verified. You can sign in now.')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('offers recovery for missing verification tokens', () => {
  history.replaceState({}, '', '/verify')
  render(<AuthScreen onAuthenticated={vi.fn()} />)
  expect(screen.getByText('Verification link is missing a token. Request a new link.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
  expect(screen.getByRole('heading', { name: 'Resend verification email' })).toBeTruthy()
})

it('sends verification recovery to the resend endpoint', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) })
  vi.stubGlobal('fetch', fetcher)
  render(<AuthScreen onAuthenticated={vi.fn()} initialMode="resend" />)
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/verification/resend'), expect.objectContaining({ credentials: 'include' })))
})
