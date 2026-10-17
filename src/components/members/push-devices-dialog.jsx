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
 * `canSend` (administrators): two tabs — Devices · Send notification (Title + Description, to all of this member's
 * devices or the chosen ones; push only, no bell copy).
 */
export default function PushDevicesDialog({ userId, menuKey, canSend = false }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const [devices, setDevices] = useState(null);
    const [busy, setBusy] = useState(null);
    const [tab, setTab] = useState('devices');
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
        setTab('devices');
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

    const list =
        devices === null ? (
            <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-ink-gray" />
            </div>
        ) : devices.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-gray">{t('push.devices.none')}</p>
        ) : (
            <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
                {devices.map((d) => (
                    <li key={d.id} className="flex items-start gap-3 px-3 py-2.5">
                        <DeviceText d={d} locale={locale} t={t} />
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
                ))}
            </ul>
        );
    // Two tabs (administrators, with at least one device): Devices · Send notification. Otherwise just the list.
    const tabbed = canSend && devices?.length > 0;

    return (
        <>
            <MenuOpener id={menuKey} open={show} />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent focusPopup className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('push.devices.title')}</DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">
                            {t(tab === 'send' && tabbed ? 'push.devices.sendHint' : 'push.devices.hint')}
                        </DialogDescription>
                    </DialogHeader>
                    {tabbed && (
                        <div role="tablist" className="grid grid-cols-2 rounded-md bg-surface-bggray/70 p-0.5">
                            {[
                                ['devices', Smartphone, `${t('push.devices.tabDevices')} (${devices.length})`],
                                ['send', Send, t('push.devices.tabSend')],
                            ].map(([key, Icon, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    onClick={() => setTab(key)}
                                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded text-xs font-medium ${
                                        tab === key ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'
                                    }`}
                                >
                                    <Icon className="size-3.5" /> {label}
                                </button>
                            ))}
                        </div>
                    )}
                    {tabbed && tab === 'send' ? (
                        <SendToMember
                            userId={userId}
                            devices={devices}
                            onSent={() => {
                                reload();
                                setTab('devices'); // the "Last notification" times just changed
                            }}
                        />
                    ) : (
                        list
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

/** One device: icon, "Chrome · Android", turned on, last notification. */
function DeviceText({ d, locale, t }) {
    const Icon = isPhone(d.user_agent) ? Smartphone : Monitor;
    return (
        <>
            <Icon className="mt-0.5 size-4 shrink-0 text-ink-gray" />
            <div className="min-w-0 flex-1 text-xs">
                <p className="truncate text-sm font-medium text-primary">{deviceName(d.user_agent)}</p>
                <p className="text-ink-gray">
                    {t('push.devices.since')}: <span className="text-ink">{when(d.created_at, locale)}</span>
                </p>
                <p className="text-ink-gray">
                    {t('push.devices.lastSent')}: <span className="text-ink">{when(d.last_used_at, locale) ?? t('push.devices.never')}</span>
                </p>
            </div>
        </>
    );
}

/**
 * Title + Description → this member's devices (sendPushMessage, target 'members'). More than one device: All devices
 * (default) or Choose — tick the ones to reach. Clears and refreshes on success.
 */
function SendToMember({ userId, devices, onSent }) {
    const { t, locale } = useT();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [mode, setMode] = useState('all');
    const [picked, setPicked] = useState(() => new Set(devices.map((d) => d.id)));
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
    const several = devices.length > 1;
    const toggle = (id) =>
        setPicked((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    return (
        <form action={action} className="space-y-3">
            <input type="hidden" name="target" value="members" />
            <input type="hidden" name="member_ids" value={userId} />
            <input type="hidden" name="devices" value={several ? mode : 'all'} />
            {several && (
                // Not Field (a <label>): it would pass a click on its text to the first button.
                <div>
                    <span className="mb-1 block text-xs font-medium text-ink-gray">{t('push.devices.sendTo')}</span>
                    <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                        {['all', 'selected'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`h-8 shrink-0 rounded px-3 text-xs font-medium ${mode === m ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'}`}
                            >
                                {m === 'all' ? t('push.devices.allDevices', { count: devices.length }) : t('push.devices.chooseDevices')}
                            </button>
                        ))}
                    </div>
                    {mode === 'selected' && (
                        <ul className="mt-2 divide-y divide-surface-border rounded-md border border-surface-border">
                            {devices.map((d) => (
                                <li key={d.id}>
                                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-accent">
                                        <input
                                            type="checkbox"
                                            name="device_ids"
                                            value={d.id}
                                            checked={picked.has(d.id)}
                                            onChange={() => toggle(d.id)}
                                            className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-orange-strong)]"
                                        />
                                        <DeviceText d={d} locale={locale} t={t} />
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    {err('devices') && <p className="mt-1 text-xs font-medium text-destructive">{err('devices')}</p>}
                </div>
            )}
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
                <SubmitButton icon={Send} pending={pending || (several && mode === 'selected' && picked.size === 0)} pendingText={t('push.admin.sending')}>
                    {t('push.admin.send')}
                </SubmitButton>
            </div>
        </form>
    );
}
