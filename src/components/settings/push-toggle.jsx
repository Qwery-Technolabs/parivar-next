'use client';
import { BellRing, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';
import { currentSubscription, disablePush, enablePush, pushSupported, rememberPushChoice } from '@/lib/push-client';

/**
 * Browser notifications on/off for THIS device. States: checking → unsupported | denied |
 * off | on. The switch reflects what the browser really has, not a stored preference.
 */
export default function PushToggle({ publicKey, userId }) {
    const { t } = useT();
    const [state, setState] = useState('checking');
    const [busy, setBusy] = useState(false);

    // Reading the browser's permission/subscription can only happen after mount.
    useEffect(() => {
        let alive = true;
        (async () => {
            let next = 'off';
            if (!publicKey || !pushSupported()) next = 'unsupported';
            else if (Notification.permission === 'denied') next = 'denied';
            else next = (await currentSubscription()) ? 'on' : 'off';
            if (alive) setState(next);
        })();
        return () => {
            alive = false;
        };
    }, [publicKey]);

    async function enable() {
        setBusy(true);
        try {
            const next = await enablePush(publicKey, { test: true });
            setState(next);
            if (next === 'on') {
                rememberPushChoice(userId, true);
                toast.success(t('push.enabledTest'));
            }
        } catch {
            toast.error(t('push.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function disable() {
        setBusy(true);
        await disablePush();
        // Turned off by hand: not switched back on silently at the next login.
        rememberPushChoice(userId, false);
        setState('off');
        setBusy(false);
    }

    if (state === 'checking') return <Loader2 className="size-4 animate-spin text-ink-gray" />;
    if (state === 'unsupported') return <p className="text-sm text-ink-gray">{t('push.unsupported')}</p>;
    if (state === 'denied') return <p className="text-sm text-destructive">{t('push.denied')}</p>;

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Switch
                checked={state === 'on'}
                disabled={busy}
                onChange={(v) => (v ? enable() : disable())}
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
                    onClick={enable}
                    className="btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium disabled:opacity-60"
                >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} {t('push.test')}
                </button>
            )}
        </div>
    );
}
