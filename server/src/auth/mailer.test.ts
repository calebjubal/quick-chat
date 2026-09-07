import { expect, it, vi } from 'vitest'
vi.mock('../env.js', () => ({ env: { NODE_ENV: 'development' } }))
import { requireMailConfiguration, sendAccountEmail } from './mailer.js'
it('does not falsely report email delivery when SMTP is absent', async () => {
  expect(requireMailConfiguration).toThrow('Email service is unavailable')
  await expect(sendAccountEmail('user@example.com', 'Verify', 'https://chat.example.com/verify')).rejects.toThrow('Email service is unavailable')
})
