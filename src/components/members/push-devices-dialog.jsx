'use client';
import { Loader2, Monitor, Send, Smartphone, Trash2 } from 'lucide-react';
import { useActionState, useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deletePushDevice, loadPushDevices, sendPushMessage } from '@/app/actions/push';
import { MenuOpener } from '@/components/shell/page-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, textArea, textInput } from '@/components/ui/field';
import MultiSelect from '@/components/ui/multi-select';
import SubmitButton from '@/components/ui/submit-button';
import SwitchBox from '@/components/ui/switch-box';
import { deviceName, isPhone } from '@/lib/device-name';
import { date, time } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

// DATETIME arrives as 'YYYY-MM-DD HH:MM:SS' (app timezone).
const when = (v, locale) => (v ? `${date(v, locale)}, ${time(String(v).slice(11, 16))}` : null);

/**
 * Member profile ⋮ → Notification devices (admins, and the member themself): each device (push token) with when it
 * was turned on and when a notification last reached it; remove one. Loaded when it opens, never with the page.
 * `canSend` (administrators): two tabs — Devices · Send notification (Title + Description, to all of this member's
 * devices or the chosen ones; push only, no bell copy).
 * Opened from the profile ⋮ (`menuKey`, a PageMenu item) or by any button (`trigger(open)`, e.g. the members list bell).
 */
export default function PushDevicesDialog({ userId, menuKey = null, trigger = null, canSend = false }) {
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
            {menuKey ? <MenuOpener id={menuKey} open={show} /> : trigger?.(show)}
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
 * Title + Description → this member's devices (sendPushMessage, target 'members'). Optional, behind switches: a page to
 * open on tap; only some devices (more than one) — off = every device. Clears and refreshes on success.
 */
function SendToMember({ userId, devices, onSent }) {
    const { t, locale } = useT();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [withLink, setWithLink] = useState(false);
    const [someDevices, setSomeDevices] = useState(false);
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
    return (
        <form action={action} className="space-y-3">
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
            {/* Optional parts, each behind its switch, side by side: a page to open on tap; only some devices. */}
            <div className={`grid gap-3 ${several ? 'sm:grid-cols-2' : ''}`}>
                <SwitchBox label={t('push.admin.linkSwitch')} hint={t('push.admin.linkOff')} on={withLink} onChange={setWithLink}>
                    <input
                        name="link"
                        type="text"
                        inputMode="url"
                        maxLength={500}
                        placeholder="/fundraise/12"
                        aria-label={t('push.admin.link')}
                        className={`${textInput(!!err('link'))} w-full`}
                    />
                    {err('link') ? (
                        <p className="text-xs font-medium text-destructive">{err('link')}</p>
                    ) : (
                        <p className="text-xs text-ink-gray">{t('push.admin.linkHint')}</p>
                    )}
                </SwitchBox>
                {several && (
                    <SwitchBox
                        label={t('push.devices.someSwitch')}
                        hint={t('push.devices.allDevices', { count: devices.length })}
                        on={someDevices}
                        onChange={setSomeDevices}
                    >
                        {/* Searchable; "2 selected" in the box. Off = every device. */}
                        <MultiSelect
                            name="device_ids"
                            inline
                            summary={(n) => t('push.devices.selected', { count: n })}
                            options={devices.map((d) => ({
                                value: String(d.id),
                                label: deviceName(d.user_agent),
                                sub: `${t('push.devices.lastSent')}: ${when(d.last_used_at, locale) ?? t('push.devices.never')}`,
                            }))}
                            placeholder={t('push.devices.chooseDevices')}
                        />
                        {err('devices') && <p className="text-xs font-medium text-destructive">{err('devices')}</p>}
                    </SwitchBox>
                )}
            </div>
            <div className="flex justify-end">
                <SubmitButton icon={Send} pending={pending} pendingText={t('push.admin.sending')}>
                    {t('push.admin.send')}
                </SubmitButton>
            </div>
        </form>
    );
}
