'use client';
import { BellRing, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';
import { currentSubscription, enablePush, pushChoice, pushSupported, rememberPushChoice } from '@/lib/push-client';

// Set by createSession (lib/auth.js) on every login / first sign-up; read once here, then cleared.
const ASK_COOKIE = 'pv_push_ask';

function takeLoginMark() {
    const has = document.cookie.split('; ').some((c) => c === `${ASK_COOKIE}=1`);
    if (has) document.cookie = `${ASK_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return has;
}

/**
 * After a login (or the first sign-up): ask for notifications on this device.
 *  - already said yes on this device (and the browser still allows it) → switched back on silently, no question;
 *  - otherwise a small card: Allow (the browser's own prompt — it needs a tap) / Not now;
 *  - "Not now" or the Settings switch turned off → not asked again here except at the next login;
 *  - blocked in the browser, or no browser support → nothing.
 * Also asks once, without a login, someone who was never asked on this device (signed in before this existed).
 * One browser holds one subscription and the server keeps it for the person who saved it last — never two people.
 */
export default function PushPrompt({ publicKey, userId }) {
    const { t } = useT();
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!publicKey || !pushSupported()) return;
        const login = takeLoginMark();
        let alive = true;
        (async () => {
            if (Notification.permission === 'denied') return;
            const choice = pushChoice(userId);
            if (login && choice === 'yes' && Notification.permission === 'granted') {
                // They allowed it before on this device: on again for them (the token is saved for THIS person).
                await enablePush(publicKey).catch(() => {});
                return;
            }
            const sub = await currentSubscription();
            const ask = login ? choice !== 'yes' || !sub : choice === null && !sub;
            if (alive && ask) setShow(true);
        })();
        return () => {
            alive = false;
        };
    }, [publicKey, userId]);

    if (!show) return null;

    async function allow() {
        setBusy(true);
        try {
            const next = await enablePush(publicKey);
            rememberPushChoice(userId, next === 'on');
            if (next === 'on') toast.success(t('push.enabled'));
            setShow(false);
        } catch {
            toast.error(t('push.failed'));
        } finally {
            setBusy(false);
        }
    }

    function later() {
        rememberPushChoice(userId, false);
        setShow(false);
    }

    return (
        // Above the phone's bottom bar; bottom-right on a desktop.
        <div
            role="dialog"
            aria-labelledby="push-prompt-title"
            className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-xl border border-surface-border bg-white p-3.5 shadow-lg sm:left-auto sm:right-4 sm:w-88 lg:bottom-4"
        >
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange-strong">
                    <BellRing className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p id="push-prompt-title" className="text-sm font-semibold text-primary">
                        {t('push.promptTitle')}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-gray">{t('push.promptText')}</p>
                    <div className="mt-3 flex gap-2">
                        <Button onClick={allow} disabled={busy}>
                            {busy ? <Loader2 className="animate-spin" /> : <BellRing />} {t('push.allow')}
                        </Button>
                        <Button variant="ghost" onClick={later} disabled={busy}>
                            {t('push.notNow')}
                        </Button>
                    </div>
                </div>
                <button type="button" onClick={later} aria-label={t('common.close')} className="-m-1 rounded p-1 text-ink-gray hover:bg-accent">
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
