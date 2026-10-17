'use client';
import { Loader2, Monitor, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deletePushDevice, loadPushDevices } from '@/app/actions/push';
import { MenuOpener } from '@/components/shell/page-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
 */
export default function PushDevicesDialog({ userId, menuKey }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const [devices, setDevices] = useState(null);
    const [busy, setBusy] = useState(null);
    const [, startTransition] = useTransition();

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
                </DialogContent>
            </Dialog>
        </>
    );
}
