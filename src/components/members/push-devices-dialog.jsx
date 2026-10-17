'use client';
import { Loader2, Monitor, Send, Smartphone, Trash2 } from 'lucide-react';
import { useActionState, useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deletePushDevice, loadPushDevices, sendPushMessage } from '@/app/actions/push';
import { MenuOpener } from '@/components/shell/page-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { date, time } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

/** "Chrome · Android" from a user agent — enough to tell one's devices apart. */
function deviceName(ua = '') {
    const s = String(ua ?? '');
    const browser = /SamsungBrowser/.test(s)
        ? 'Samsung Internet'
        : /Edg\//.test(s)
          ? 'Edge'
          : /OPR\//.test(s)
            ? 'Opera'
            : /Firefox\//.test(s)
              ? 'Firefox'
              : /Chrome\//.test(s)
                ? 'Chrome'
                : /Safari\//.test(s)
                  ? 'Safari'
                  : null;
    const os = /iPhone|iPad/.test(s)
        ? 'iPhone / iPad'
        : /Android/.test(s)
          ? 'Android'
          : /Windows/.test(s)
            ? 'Windows'
            : /Mac OS X/.test(s)
              ? 'Mac'
              : /Linux/.test(s)
                ? 'Linux'
                : null;
    return [browser, os].filter(Boolean).join(' · ') || '—';
}
const isPhone = (ua) => /Android|iPhone|iPad|Mobile/.test(String(ua ?? ''));
// DATETIME arrives as 'YYYY-MM-DD HH:MM:SS' (app timezone).
const when = (v, locale) => (v ? `${date(v, locale)}, ${time(String(v).slice(11, 16))}` : null);

/**
 * Member profile ⋮ → Notification devices (admins, and the member themself): each device (push token) with when it
 * was turned on and when a notification last reached it; remove one. Loaded when it opens, never with the page.
 * `canSend` (administrators): a Title + Description form under the list sends a push to this member's devices only
 * (Settings → Samaj → Push notification, target = this member; push only, no bell copy).
 */
export default function PushDevicesDialog({ userId, menuKey, canSend = false }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const [devices, setDevices] = useState(null);
    const [busy, setBusy] = useState(null);
    const [, startTransition] = useTransition();

    const reload = useCallback(
        () =>
            startTransition(async () => {
                const res = await loadPushDevices(userId);
                if (!res?.error) setDevices(res.devices);
            }),
        [userId],
    );

    const show = useCallback(() => {
        setOpen(true);
        setDevices(null);
        startTransition(async () => {
            const res = await loadPushDevices(userId);
            if (res?.error) {
                toast.error(t(res.error));
                setOpen(false);
            } else setDevices(res.devices);
        });
    }, [userId, t]);

    async function remove(id) {
        if (!window.confirm(t('push.devices.removeConfirm'))) return;
        setBusy(id);
        const res = await deletePushDevice(id);
        setBusy(null);
        if (res?.error) return toast.error(t(res.error));
        setDevices((list) => list.filter((d) => d.id !== id));
        toast.success(t('push.devices.removed'));
    }

    return (
        <>
            <MenuOpener id={menuKey} open={show} />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent focusPopup className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('push.devices.title')}</DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">{t('push.devices.hint')}</DialogDescription>
                    </DialogHeader>
                    {devices === null ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="size-5 animate-spin text-ink-gray" />
                        </div>
                    ) : devices.length === 0 ? (
                        <p className="py-4 text-center text-sm text-ink-gray">{t('push.devices.none')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
                            {devices.map((d) => {
                                const Icon = isPhone(d.user_agent) ? Smartphone : Monitor;
                                return (
                                    <li key={d.id} className="flex items-start gap-3 px-3 py-2.5">
                                        <Icon className="mt-0.5 size-4 shrink-0 text-ink-gray" />
                                        <div className="min-w-0 flex-1 text-xs">
                                            <p className="truncate text-sm font-medium text-primary">{deviceName(d.user_agent)}</p>
                                            <p className="text-ink-gray">
                                                {t('push.devices.since')}: <span className="text-ink">{when(d.created_at, locale)}</span>
                                            </p>
                                            <p className="text-ink-gray">
                                                {t('push.devices.lastSent')}:{' '}
                                                <span className="text-ink">{when(d.last_used_at, locale) ?? t('push.devices.never')}</span>
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => remove(d.id)}
                                            disabled={busy === d.id}
                                            aria-label={t('push.devices.remove')}
                                            title={t('push.devices.remove')}
                                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-60"
                                        >
                                            {busy === d.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {canSend && devices?.length > 0 && <SendToMember userId={userId} onSent={reload} />}
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Title + Description → this member's devices (sendPushMessage, target 'members'). Clears and refreshes on success. */
function SendToMember({ userId, onSent }) {
    const { t } = useT();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await sendPushMessage(prev, fd);
        if (res?.ok) {
            toast.success(t(res.message, res.vars));
            setTitle('');
            setBody('');
            onSent();
        } else if (res?.error) toast.error(t(res.error));
        return res;
    }, null);
    const err = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);
    return (
        <form action={action} className="space-y-2.5 border-t border-surface-border pt-3">
            <p className="text-sm font-semibold text-primary">{t('push.devices.send')}</p>
            <input type="hidden" name="target" value="members" />
            <input type="hidden" name="member_ids" value={userId} />
            <Field label={t('push.admin.title')} error={err('title')} required>
                <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={`${textInput(!!err('title'))} w-full`} />
            </Field>
            <Field label={t('push.admin.body')} error={err('body')} required>
                <textarea
                    name="body"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={300}
                    className={`${textArea(!!err('body'))} w-full`}
                />
            </Field>
            <div className="flex justify-end">
                <SubmitButton icon={Send} pending={pending} pendingText={t('push.admin.sending')}>
                    {t('push.admin.send')}
                </SubmitButton>
            </div>
        </form>
    );
}
