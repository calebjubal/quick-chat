import { expect, test } from '@playwright/test'

test('two named guests share a persistent text chat on one origin', async ({ browser }) => {
  test.skip(process.env.E2E_RUN_WRITES !== 'true' || !process.env.E2E_BASE_URL, 'Use an isolated staging database and opt into writes.')
  const baseURL = process.env.E2E_BASE_URL!
  const options = { baseURL, extraHTTPHeaders: { Origin: new URL(baseURL).origin } }
  const alice = await browser.newContext(options)
  const bob = await browser.newContext(options)
  let conversationId: string | undefined
  try {
    expect((await alice.request.post('/api/v1/auth/guest', { data: { displayName: 'E2E creator' } })).status()).toBe(201)
    expect((await bob.request.post('/api/v1/auth/guest', { data: { displayName: 'E2E recipient' } })).status()).toBe(201)
    const created = await alice.request.post('/api/v1/conversations/shared', { data: { title: 'E2E private chat' } })
    expect(created.status()).toBe(201)
    const data = await created.json()
    conversationId = data.conversation.id
    const token = new URL(data.shareUrl).searchParams.get('join')!
    expect((await bob.request.post('/api/v1/conversations/shared/' + encodeURIComponent(token) + '/join', { data: { displayName: 'E2E recipient' } })).ok()).toBeTruthy()
    const page = await bob.newPage()
    await page.goto('/')
    await page.getByRole('tab', { name: 'Sent to you' }).click()
    await page.getByRole('button', { name: /E2E private chat/ }).click()
    const id = crypto.randomUUID()
    const message = { id, body: 'Polling journey ' + id }
    const endpoint = '/api/v1/conversations/' + conversationId + '/messages'
    expect((await alice.request.post(endpoint, { data: message })).status()).toBe(201)
    expect((await (await alice.request.post(endpoint, { data: message })).json()).deduplicated).toBe(true)
    await expect(page.getByText(message.body, { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('tab', { name: 'Sent to you' }).click()
    await page.getByRole('button', { name: /E2E private chat/ }).click()
    await expect(page.getByText(message.body, { exact: true })).toBeVisible()
    expect((await bob.request.post('/api/v1/auth/logout')).status()).toBe(204)
    expect((await bob.request.get('/api/v1/auth/session')).status()).toBe(401)
  } finally {
    if (conversationId) await alice.request.delete('/api/v1/conversations/' + conversationId)
    await alice.request.post('/api/v1/auth/logout')
    await alice.close()
    await bob.close()
  }
})
