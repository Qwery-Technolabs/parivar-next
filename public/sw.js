/* Parivar service worker — shows Web Push notifications and opens the right page on tap.
   Kept deliberately small: no offline caching, so it can never serve a stale app. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }
    event.waitUntil(
        self.registration.showNotification(data.title || 'Parivar', {
            body: data.body || '',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.tag, // same tag replaces the previous notification instead of stacking
            data: { link: data.link || '/notifications' },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = event.notification.data?.link || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
            // Reuse an open Parivar tab if there is one; otherwise open a new one.
            for (const w of wins) {
                if (new URL(w.url).origin === self.location.origin) {
                    w.navigate(link);
                    return w.focus();
                }
            }
            return self.clients.openWindow(link);
        }),
    );
});
