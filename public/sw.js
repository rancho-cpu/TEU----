self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? '새 알림'
  const options = {
    body: data.body ?? '',
    icon: '/pwa-icon.png',
    badge: '/pwa-icon.png',
    data: { url: data.url ?? '/' },
    requireInteraction: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
