/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[]
}

self.addEventListener('install', () => self.skipWaiting())
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  const data = (event as PushEvent).data?.json() ?? {}
  const title: string = data.title ?? 'JAM'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url ?? '/gastos-recurrentes' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const ne = event as NotificationEvent
  ne.notification.close()
  const url: string = ne.notification.data?.url ?? '/'
  ne.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.endsWith(url) && 'focus' in client) return client.focus()
        }
        return self.clients.openWindow(url)
      }),
  )
})
