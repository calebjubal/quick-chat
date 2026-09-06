import { clientEnv } from './env'

const decodeKey = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob((value + padding).replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0))
}

export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported on this device.')
  if (!clientEnv.VITE_VAPID_PUBLIC_KEY) throw new Error('Push notifications are not configured.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(clientEnv.VITE_VAPID_PUBLIC_KEY) })
  const response = await fetch(`${clientEnv.VITE_API_URL}/api/v1/push-subscriptions`, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) throw new Error('Unable to enable notifications.')
}

export async function updateNotificationFocus(conversationId: string | null) {
  await fetch(`${clientEnv.VITE_API_URL}/api/v1/push-subscriptions/focus`, {
    method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversationId }),
  })
}
