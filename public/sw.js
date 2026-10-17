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
            // The Samaj logo (Settings → General), like the favicon; falls back to favicon.ico.
            icon: data.icon || '/api/app-icon?size=192',
            // One-colour Samaj logo (Android shows only its shape — a coloured square would be a blank white box).
            badge: data.badge || '/api/app-icon?badge=1',
            tag: data.tag, // same tag replaces the previous notification instead of stacking
            data: { link: data.link || '/notifications' },
        }),
    );
});

/** Ask an open app window to go to `link` itself (client-side, no reload). Resolves true when it answered. */
function routeInApp(win, link) {
    return new Promise((resolve) => {
        const ch = new MessageChannel();
        const timer = setTimeout(() => resolve(false), 800);
        ch.port1.onmessage = () => {
            clearTimeout(timer);
            resolve(true);
        };
        try {
            win.postMessage({ type: 'pv-open', link }, [ch.port2]);
        } catch {
            clearTimeout(timer);
            resolve(false);
        }
    });
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Only pages of this app; anything else falls back to the home page.
    let url = new URL('/', self.location.origin);
    try {
        const u = new URL(event.notification.data?.link || '/', self.location.origin);
        if (u.origin === self.location.origin) url = u;
    } catch {
        // a bad link: home
    }
    const link = url.pathname + url.search + url.hash;
    event.waitUntil(
        (async () => {
            const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            // The installed app's window first, then any open tab of the app.
            const win = wins.find((w) => w.url.startsWith(self.location.origin) && w.frameType !== 'nested');
            if (!win) return self.clients.openWindow(url.href);
            // Bring it forward at once (must happen while the tap still counts), then go to the page in place —
            // the app's own router (components/shell/push-navigator.jsx), no reload. No answer → a normal load.
            const focused = await win.focus().catch(() => win);
            if (await routeInApp(focused, link)) return;
            if ('navigate' in focused) return focused.navigate(url.href).catch(() => self.clients.openWindow(url.href));
            return self.clients.openWindow(url.href);
        })(),
    );
});
