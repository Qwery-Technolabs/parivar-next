'use client';
// Browser side of Web Push — shared by Settings → Notifications (PushToggle), the after-login prompt (PushPrompt)
// and Log out. One browser = one subscription (token); the server keeps it for ONE person (the last who saved it).

/** The VAPID public key is base64url; PushManager wants the raw bytes. */
function keyBytes(base64url) {
    const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
    const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration() {
    return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function currentSubscription() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration('/');
    return (await reg?.pushManager.getSubscription()) ?? null;
}

// Per person on this device: they said yes (re-enable silently on their next login) or "not now".
const okKey = (uid) => `pv-push-ok:${uid}`;
const noKey = (uid) => `pv-push-no:${uid}`;
const store = (fn) => {
    try {
        return fn(window.localStorage);
    } catch {
        return null;
    }
};
export const pushChoice = (uid) => store((s) => (s.getItem(okKey(uid)) ? 'yes' : s.getItem(noKey(uid)) ? 'no' : null));
export function rememberPushChoice(uid, yes) {
    store((s) => {
        s.removeItem(yes ? noKey(uid) : okKey(uid));
        s.setItem(yes ? okKey(uid) : noKey(uid), '1');
    });
}

/**
 * Ask the browser (a no-op when already allowed), subscribe and save it for the signed-in member.
 * Returns 'on' | 'denied' | 'off'; throws when the save fails.
 */
export async function enablePush(publicKey, { test = false } = {}) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
        (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), test }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return 'on';
}

/** Forget this browser on the server and in the browser (turned off, or logging out). Never throws. */
export async function disablePush() {
    try {
        const sub = await currentSubscription();
        if (!sub) return;
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(
            () => {},
        );
        await sub.unsubscribe();
    } catch {
        // Logging out must never be blocked by the browser's push service.
    }
}
