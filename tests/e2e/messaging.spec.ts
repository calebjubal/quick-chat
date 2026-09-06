import { expect, test, type BrowserContext } from '@playwright/test'

const accountA = { email: process.env.E2E_USER_A_EMAIL ?? '', password: process.env.E2E_USER_A_PASSWORD ?? '', username: process.env.E2E_USER_A_USERNAME ?? '' }
const accountB = { email: process.env.E2E_USER_B_EMAIL ?? '', password: process.env.E2E_USER_B_PASSWORD ?? '', username: process.env.E2E_USER_B_USERNAME ?? '' }
const configured = Object.values(accountA).every(Boolean) && Object.values(accountB).every(Boolean)
const apiBase = (process.env.E2E_API_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const api = (path: string) => `${apiBase}/api/v1${path}`

async function signIn(context: BrowserContext, account: typeof accountA) {
  const response = await context.request.post(api('/auth/login'), { data: { email: account.email, password: account.password } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).user as { id: string }
}

test.describe.serial('complete messaging journeys', () => {
  test.skip(!configured, 'Set both verified E2E account credentials to run production journeys.')

  test('two accounts exchange messages and receipts without duplicates', async ({ browser }) => {
    const alice = await browser.newContext(); const bob = await browser.newContext()
    const aliceUser = await signIn(alice, accountA); await signIn(bob, accountB)
    const lookup = await alice.request.get(api(`/users/lookup?username=${encodeURIComponent(accountB.username)}`)); expect(lookup.ok()).toBeTruthy()
    const bobUser = (await lookup.json()).user as { id: string }
    const created = await alice.request.post(api('/conversations/direct'), { data: { userId: bobUser.id } }); expect(created.ok()).toBeTruthy()
    const conversationId = (await created.json()).conversation.id as string; const messageId = crypto.randomUUID()
    const first = await alice.request.post(api(`/conversations/${conversationId}/messages`), { data: { id: messageId, body: 'Production journey message' } }); expect(first.status()).toBe(201)
    const replay = await alice.request.post(api(`/conversations/${conversationId}/messages`), { data: { id: messageId, body: 'Production journey message' } }); expect((await replay.json()).deduplicated).toBe(true)
    const history = await bob.request.get(api(`/conversations/${conversationId}/messages`)); const message = (await history.json()).messages.find((item: { id: string }) => item.id === messageId); expect(message.senderId).toBe(aliceUser.id)
    const bobSecondDevice = await browser.newContext(); await signIn(bobSecondDevice, accountB)
    const receipt = await bobSecondDevice.request.patch(api(`/conversations/${conversationId}/receipts`), { data: { deliveredSequence: message.sequence, readSequence: message.sequence } }); expect(receipt.ok()).toBeTruthy()
    await bobSecondDevice.close()
    await alice.close(); await bob.close()
  })

  test('groups, privacy controls, blocking, and disappearing timers converge', async ({ browser }) => {
    const alice = await browser.newContext(); const bob = await browser.newContext()
    await signIn(alice, accountA); await signIn(bob, accountB)
    const bobUser = (await (await alice.request.get(api(`/users/lookup?username=${encodeURIComponent(accountB.username)}`))).json()).user as { id: string }
    const group = await alice.request.post(api('/conversations/groups'), { data: { title: 'E2E group', memberIds: [bobUser.id] } }); expect(group.status()).toBe(201)
    const groupId = (await group.json()).conversation.id as string
    expect((await alice.request.patch(api(`/conversations/${groupId}`), { data: { disappearingSeconds: 86400 } })).ok()).toBeTruthy()
    expect((await alice.request.patch(api('/me/settings'), { data: { readReceiptsEnabled: false, lastSeenVisibility: 'nobody' } })).ok()).toBeTruthy()
    const upload = await alice.request.post(api('/uploads'), { data: { fileName: 'journey.png', mimeType: 'image/png', byteSize: 128 } }); expect(upload.status()).toBe(201); expect((await upload.json()).uploadUrl).toMatch(/^https?:/)
    const vapid = await alice.request.get(api('/push-subscriptions/vapid-key')); expect(vapid.ok()).toBeTruthy()
    expect((await alice.request.post(api(`/blocks/${bobUser.id}`))).status()).toBe(201)
    const direct = await alice.request.post(api('/conversations/direct'), { data: { userId: bobUser.id } }); expect(direct.status()).toBe(404)
    expect((await alice.request.delete(api(`/blocks/${bobUser.id}`))).status()).toBe(204)
    await alice.close(); await bob.close()
  })

  test('cached shell remains available while offline', async ({ browser }) => {
    const context = await browser.newContext(); await signIn(context, accountA)
    const page = await context.newPage(); await page.goto('/'); await expect(page.getByText('Messages', { exact: true })).toBeVisible()
    await context.setOffline(true); await page.reload(); await expect(page.locator('body')).toContainText(/Messages|Loading your conversations/)
    await context.close()
  })
})
