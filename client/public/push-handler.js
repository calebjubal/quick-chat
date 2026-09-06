self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? { title: 'Quickchat', body: 'New message', url: '/' }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const focused = clients.find((client) => client.visibilityState === 'visible')
    if (focused) {
      focused.postMessage({ type: 'quickchat:push', payload })
      return
    }
    return self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    })
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients[0]
    if (existing) {
      existing.navigate(event.notification.data?.url ?? '/')
      return existing.focus()
    }
    return self.clients.openWindow(event.notification.data?.url ?? '/')
  }))
})
