'use client';
import { Bell, CalendarDays, CalendarClock, Droplet, HandCoins, MessageCircle, Save, UserPlus, Users } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { saveAdminNotify, saveNotificationPrefs } from '@/app/actions/settings';
import { Card } from '@/components/shell/page-header';
import SubmitButton from '@/components/ui/submit-button';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

const ICONS = { blood: Droplet, calendar: CalendarDays, meetings: CalendarClock, fundraise: HandCoins, groups: Users, discussion: MessageCircle, members: UserPlus };

function useSave(action) {
    const { t } = useT();
    return useActionState(async (prev, fd) => {
        const res = await action(prev, fd);
        if (res?.ok) toast.success(t(res.message));
        else if (res?.error) toast.error(t(res.error));
        return res;
    }, null);
}

/**
 * Settings → Notifications, "What to notify me about": one switch per category. Off stops both
 * the in-app notice and the browser push of that kind for this person.
 * @param {{ categories: string[], off: string[] }} props
 */
export function NotificationPrefs({ categories, off }) {
    const { t } = useT();
    const [on, setOn] = useState(() => Object.fromEntries(categories.map((c) => [c, !off.includes(c)])));
    const [, action, pending] = useSave(saveNotificationPrefs);
    return (
        <Card title={t('settings.notify.mineTitle')}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(() => action(fd));
                }}
                className="space-y-3"
            >
                <p className="text-xs text-ink-gray">{t('settings.notify.mineHint')}</p>
                <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
                    {categories.map((c) => {
                        const Icon = ICONS[c] ?? Bell;
                        return (
                            <li key={c} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                <span className="flex min-w-0 items-center gap-2 text-sm text-primary">
                                    <Icon className="size-4 shrink-0 text-ink-gray" />
                                    <span className="min-w-0">
                                        <span className="block font-medium">{t(`settings.notify.categories.${c}.title`)}</span>
                                        <span className="block text-xs text-ink-gray">{t(`settings.notify.categories.${c}.hint`)}</span>
                                    </span>
                                </span>
                                {on[c] && <input type="hidden" name="on" value={c} />}
                                <Switch checked={on[c]} onChange={(v) => setOn((s) => ({ ...s, [c]: v }))} label="" title={t(`settings.notify.categories.${c}.title`)} />
                            </li>
                        );
                    })}
                </ul>
                <div className="flex justify-end">
                    <SubmitButton icon={Save} pendingText={t('common.saving')} pending={pending}>
                        {t('common.save')}
                    </SubmitButton>
                </div>
            </form>
        </Card>
    );
}

/**
 * Settings → Notifications (administrators): the app-wide switches that used to sit in the
 * Blood and Calendar sections.
 * @param {{ values: { notify_donors: boolean, notify_new_event: boolean } }} props
 */
export function AdminNotifySettings({ values }) {
    const { t } = useT();
    const [donors, setDonors] = useState(values.notify_donors);
    const [events, setEvents] = useState(values.notify_new_event);
    const [, action, pending] = useSave(saveAdminNotify);
    return (
        <Card title={t('settings.notify.adminTitle')}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(() => action(fd));
                }}
                className="space-y-3"
            >
                <div>
                    <Switch checked={donors} onChange={setDonors} name="notify_donors" label={t('settings.keys.blood_notify_donors')} />
                </div>
                <div>
                    <Switch checked={events} onChange={setEvents} name="notify_new_event" label={t('settings.keys.events_notify_new_event')} />
                </div>
                <div className="flex justify-end">
                    <SubmitButton icon={Save} pendingText={t('common.saving')} pending={pending}>
                        {t('common.save')}
                    </SubmitButton>
                </div>
            </form>
        </Card>
    );
}
