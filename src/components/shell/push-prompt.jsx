'use client';
import { BellOff, BellRing, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { takePushReminder } from '@/app/actions/push';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';
import { currentSubscription, askDue, enablePush, markAsked, pushChoice, pushSupported, rememberPushChoice, warmServiceWorker } from '@/lib/push-client';

// Set by createSession (lib/auth.js) on every login / first sign-up; read once here, then cleared.
const ASK_COOKIE = 'pv_push_ask';

function takeLoginMark() {
    const has = document.cookie.split('; ').some((c) => c === `${ASK_COOKIE}=1`);
    if (has) document.cookie = `${ASK_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return has;
}

/**
 * After a login (or the first sign-up): notifications on this device?
 *  - that person said yes here before (and the browser still allows it) → switched back on silently, no question;
 *  - else, while this phone / browser has no notifications: a pop-up in the MIDDLE of the screen over a dimmed,
 *    blurred page — Allow (the browser's own prompt needs a tap) / Not now — on any page, at most once every 7 days
 *    (`pv-push-asked` = when it was last shown);
 *  - an admin's reminder (members list → red slashed bell, users_listmeta push_remind) shows it at the next app open
 *    even inside the 7 days; if the browser has notifications BLOCKED, the pop-up says how to unblock them instead
 *    (the browser no longer asks by itself);
 *  - nothing when notifications are already on, or unsupported.
 * The service worker is registered as soon as the app opens, so Allow only has to subscribe and save.
 * One browser holds one subscription and the server keeps it for the person who saved it last — never two people.
 */
export default function PushPrompt({ publicKey, userId }) {
    const { t } = useT();
    const [show, setShow] = useState(null); // null | 'ask' | 'blocked'
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!publicKey || !pushSupported()) return;
        // Ready before anyone taps Allow (installing the worker was most of the wait). Tiny: no offline caching.
        warmServiceWorker();
        const login = takeLoginMark();
        let alive = true;
        (async () => {
            if (login && pushChoice(userId) === 'yes' && Notification.permission === 'granted') {
                // They allowed it before on this device: on again for them (the token is saved for THIS person).
                await enablePush(publicKey).catch(() => {});
                return;
            }
            if (await currentSubscription()) return; // already on here
            // An admin asked to remind them: show now (used up by asking), whatever the 7 days say.
            const reminded = await takePushReminder().catch(() => false);
            if (!alive) return;
            if (Notification.permission === 'denied') {
                if (reminded) setShow('blocked');
                return;
            }
            // Not turned on here: ask again, but not more than once a week.
            if (!reminded && !askDue()) return;
            markAsked();
            setShow('ask');
        })();
        return () => {
            alive = false;
        };
    }, [publicKey, userId]);

    if (!show) return null;

    async function allow() {
        setBusy(true);
        // The browser's question first; the pop-up goes as soon as it is answered — saving the token happens behind.
        const permission = await Notification.requestPermission().catch(() => 'default');
        setShow(null);
        setBusy(false);
        if (permission !== 'granted') return rememberPushChoice(userId, false);
        try {
            const next = await enablePush(publicKey);
            rememberPushChoice(userId, next === 'on');
            if (next === 'on') toast.success(t('push.enabled'));
        } catch {
            toast.error(t('push.failed'));
        }
    }

    function later() {
        if (show === 'ask') rememberPushChoice(userId, false);
        setShow(null);
    }

    const blocked = show === 'blocked';
    return (
        // Centred over the whole app; the page behind is dimmed and softly blurred. Tapping outside = Not now.
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[3px]" onClick={later}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="push-prompt-title"
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl"
            >
                <button
                    type="button"
                    onClick={later}
                    aria-label={t('common.close')}
                    className="absolute top-2.5 right-2.5 rounded p-1 text-ink-gray hover:bg-accent"
                >
                    <X className="size-4" />
                </button>
                <span
                    className={`mx-auto flex size-12 items-center justify-center rounded-full ${
                        blocked ? 'bg-rose-50 text-rose-600' : 'bg-brand-orange/10 text-brand-orange-strong'
                    }`}
                >
                    {blocked ? <BellOff className="size-6" /> : <BellRing className="size-6" />}
                </span>
                <p id="push-prompt-title" className="mt-3 text-base font-semibold text-primary">
                    {t(blocked ? 'push.blockedTitle' : 'push.promptTitle')}
                </p>
                <p className="mt-1 text-sm text-ink-gray">{t(blocked ? 'push.blockedText' : 'push.promptText')}</p>
                <div className="mt-4 flex flex-col gap-2">
                    {blocked ? (
                        <Button onClick={later} className="w-full">
                            {t('common.ok')}
                        </Button>
                    ) : (
                        <>
                            <Button onClick={allow} disabled={busy} className="w-full">
                                {busy ? <Loader2 className="animate-spin" /> : <BellRing />} {t('push.allow')}
                            </Button>
                            <Button variant="ghost" onClick={later} disabled={busy} className="w-full">
                                {t('push.notNow')}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
