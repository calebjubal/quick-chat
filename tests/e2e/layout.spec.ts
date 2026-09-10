import { test, expect } from '@playwright/test'
test.use({ baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4179', channel: process.platform === 'win32' ? 'msedge' : undefined, serviceWorkers: 'block', video: 'off' })

for (const width of [320, 768, 1366]) {
  test(`auth and guest inbox fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    let signedIn = false
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const user = { id: 'layout-guest', displayName: 'Layout test', username: null, isGuest: true }
      if (path.endsWith('/auth/guest')) signedIn = true
      if (path.endsWith('/auth/session') && !signedIn) return route.fulfill({ status: 401, json: { error: { message: 'Sign in required' } } })
      return route.fulfill({ json: path.includes('/auth/') ? { user } : { conversations: [] } })
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Continue without an account' }).click()
    await page.getByLabel('Your name').fill('Layout test')
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await expect(page.getByRole('heading', { name: 'Chats', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create shareable chat' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/guest-${width}.png`, fullPage: true })
  })
}
