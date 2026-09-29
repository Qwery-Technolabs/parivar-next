'use client';
import { BellRing, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

/** The VAPID public key is base64url; PushManager wants the raw bytes. */
function keyBytes(base64url) {
    const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
    const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
    return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/**
 * Browser notifications on/off for THIS device. States: checking → unsupported | denied |
 * off | on. The switch reflects what the browser really has, not a stored preference.
 */
export default function PushToggle({ publicKey }) {
    const { t } = useT();
    const [state, setState] = useState('checking');
    const [busy, setBusy] = useState(false);

    // Reading the browser's permission/subscription can only happen after mount.
    useEffect(() => {
        let alive = true;
        (async () => {
            let next = 'off';
            if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) next = 'unsupported';
            else if (Notification.permission === 'denied') next = 'denied';
            else {
                const reg = await navigator.serviceWorker.getRegistration('/');
                next = (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
            }
            if (alive) setState(next);
        })();
        return () => {
            alive = false;
        };
    }, [publicKey]);

    async function enable(test = true) {
        setBusy(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setState(permission === 'denied' ? 'denied' : 'off');
                return;
            }
            const reg = await registration();
            await navigator.serviceWorker.ready;
            const sub =
                (await reg.pushManager.getSubscription()) ||
                (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
            const res = await fetch('/api/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...sub.toJSON(), test }),
            });
            if (!res.ok) throw new Error(String(res.status));
            setState('on');
            toast.success(t(test ? 'push.enabledTest' : 'push.enabled'));
        } catch {
            toast.error(t('push.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function disable() {
        setBusy(true);
        try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            const sub = await reg?.pushManager.getSubscription();
            if (sub) {
                await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
                await sub.unsubscribe();
            }
            setState('off');
        } finally {
            setBusy(false);
        }
    }

    if (state === 'checking') return <Loader2 className="size-4 animate-spin text-ink-gray" />;
    if (state === 'unsupported') return <p className="text-sm text-ink-gray">{t('push.unsupported')}</p>;
    if (state === 'denied') return <p className="text-sm text-destructive">{t('push.denied')}</p>;

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Switch
                checked={state === 'on'}
                disabled={busy}
                onChange={(v) => (v ? enable(true) : disable())}
                label={
                    <span className="inline-flex items-center gap-1.5">
                        <BellRing className="size-4" /> {t('push.label')}
                    </span>
                }
            />
            {state === 'on' && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => enable(true)}
                    className="btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium disabled:opacity-60"
                >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} {t('push.test')}
                </button>
            )}
        </div>
    );
}
