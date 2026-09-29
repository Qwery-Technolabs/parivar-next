import { Bell, CalendarDays, CheckCheck, Droplet, HandCoins, ShieldCheck, Trash2, Users } from 'lucide-react';
import { cookies } from 'next/headers';
import { deleteAllNotifications, deleteNotification, deleteReadNotifications, markAllRead, openNotification } from '@/app/actions/notifications';
import PageHeader from '@/components/shell/page-header';
import PageMenu from '@/components/shell/page-menu';
import Pagination from '@/components/ui/pagination';
import { requireUser } from '@/lib/auth';
import { date } from '@/lib/format';
import { getT } from '@/lib/i18n/server';
import { notificationText } from '@/lib/notification-text';
import { listNotifications, unreadCount } from '@/lib/notifications';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('notifications.title') };
}

const ICONS = {
    blood: [Droplet, 'text-rose-700 bg-rose-50'],
    group: [ShieldCheck, 'text-brand-navy bg-brand-navy/10'],
    fundraise: [HandCoins, 'text-brand-blue-deep bg-blue-50'],
    event: [CalendarDays, 'text-emerald-700 bg-emerald-50'],
};

export default async function NotificationsPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const page = normalizePage(sp.page);
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const [{ total, rows }, unread] = await Promise.all([listNotifications(user.id, page, perPage), unreadCount(user.id)]);

    return (
        <div>
            <PageHeader
                title={t('notifications.title')}
                subtitle={unread ? t('notifications.unread', { count: unread }) : undefined}
                menu={
                    total > 0 && (
                        <PageMenu
                            items={[
                                unread > 0 && { key: 'read', label: t('notifications.markAllRead'), icon: <CheckCheck />, action: markAllRead },
                                total > unread && {
                                    key: 'delete-read',
                                    label: t('notifications.deleteRead'),
                                    icon: <Trash2 />,
                                    action: deleteReadNotifications,
                                    confirm: t('notifications.deleteReadConfirm'),
                                },
                                {
                                    key: 'delete-all',
                                    label: t('notifications.deleteAll'),
                                    icon: <Trash2 />,
                                    action: deleteAllNotifications,
                                    confirm: t('notifications.deleteAllConfirm'),
                                    danger: true,
                                },
                            ]}
                        />
                    )
                }
            />
            {rows.length === 0 ? (
                <div className="rounded-lg border border-surface-border bg-white px-4 py-12 text-center text-sm text-ink-gray">
                    <Bell className="mx-auto mb-2 size-6" />
                    {t('notifications.empty')}
                </div>
            ) : (
                <ul className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                    {rows.map((n) => {
                        const [Icon, tone] = ICONS[n.type.split('.')[0]] ?? [Users, 'text-ink-gray bg-muted'];
                        const actor = (locale === 'gu' && n.actor_name_local) || n.actor_name;
                        return (
                            <li key={n.id} className="group flex items-stretch border-b border-surface-border last:border-0">
                                <form action={openNotification} className="min-w-0 flex-1">
                                    <input type="hidden" name="id" value={n.id} />
                                    <button
                                        type="submit"
                                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60 ${
                                            n.read_at ? '' : 'bg-accent/40'
                                        }`}
                                    >
                                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className={`block break-words text-sm text-primary ${n.read_at ? '' : 'font-semibold'}`}>
                                                {notificationText(n, t, locale)}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-ink-gray">
                                                {date(n.created_at.slice(0, 10), locale)} · {n.created_at.slice(11, 16)}
                                                {actor && ` · ${actor}`}
                                            </span>
                                        </span>
                                        {!n.read_at && (
                                            <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-brand-orange" />
                                        )}
                                    </button>
                                </form>
                                {/* Delete just this one. */}
                                <form action={deleteNotification} className="flex items-center pr-2">
                                    <input type="hidden" name="id" value={n.id} />
                                    <button
                                        type="submit"
                                        aria-label={t('notifications.delete')}
                                        title={t('notifications.delete')}
                                        className="flex size-8 items-center justify-center rounded-md text-ink-gray hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </form>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Pagination pathname="/notifications" searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
        </div>
    );
}
