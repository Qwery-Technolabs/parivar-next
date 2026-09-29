import { CalendarDays, Droplet, HandCoins, Users } from 'lucide-react';
import Link from 'next/link';
import { Card, StatCard } from '@/components/shell/page-header';
import { BloodBadge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { date, time } from '@/lib/format';
import { todayIST } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';

export default async function DashboardPage() {
    const user = await requireUser();
    const { t, locale } = await getT();
    const today = todayIST();

    // Four independent reads — run together, not one after another.
    const [counts, events, blood] = await Promise.all([
        queryOne(
            `SELECT
                (SELECT COUNT(*) FROM users_list WHERE status = 'active') AS members,
                (SELECT COUNT(*) FROM blood_requests WHERE status = 'open') AS blood,
                (SELECT COUNT(*) FROM fundraise_campaigns WHERE status = 'active') AS fundraise,
                (SELECT COUNT(*) FROM events_list WHERE COALESCE(end_date, start_date) >= :today) AS events`,
            { today },
        ),
        query(
            `SELECT id, title, title_local, event_type, start_date, start_time, location
               FROM events_list WHERE COALESCE(end_date, start_date) >= :today
              ORDER BY start_date, start_time LIMIT 5`,
            { today },
        ),
        query(
            `SELECT id, blood_group, units, patient_name, hospital, city, needed_by
               FROM blood_requests WHERE status = 'open' ORDER BY needed_by IS NULL, needed_by LIMIT 5`,
        ),
    ]);

    return (
        <div className="space-y-5">
            <h1 className="text-lg font-semibold text-primary">
                {t('dashboard.welcome', { name: localized(user, 'full_name', locale) })}
            </h1>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label={t('dashboard.members')} value={counts.members} href="/members" icon={Users} />
                <StatCard label={t('dashboard.openBlood')} value={counts.blood} href="/blood" icon={Droplet} />
                <StatCard label={t('dashboard.activeFundraise')} value={counts.fundraise} href="/fundraise" icon={HandCoins} />
                <StatCard label={t('dashboard.upcoming')} value={counts.events} href="/calendar" icon={CalendarDays} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
                <Card
                    title={t('dashboard.upcoming')}
                    bodyClass=""
                    actions={
                        <Link href="/calendar" className="text-xs font-medium text-primary hover:underline">
                            {t('dashboard.viewAll')}
                        </Link>
                    }
                >
                    {events.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-ink-gray">{t('dashboard.noUpcoming')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {events.map((e) => (
                                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-14 shrink-0 rounded-md bg-accent py-1 text-center">
                                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">
                                            {date(e.start_date, locale).split(' ')[1]}
                                        </p>
                                        <p className="text-base font-semibold text-primary tabular-nums">{Number(e.start_date.slice(8, 10))}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-primary break-words">{localized(e, 'title', locale)}</p>
                                        <p className="text-xs text-ink-gray">
                                            {t(`calendar.types.${e.event_type}`)}
                                            {e.start_time && ` · ${time(e.start_time)}`}
                                            {e.location && ` · ${e.location}`}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card
                    title={t('dashboard.recentBlood')}
                    bodyClass=""
                    className="theme-blood"
                    actions={
                        <Link href="/blood" className="text-xs font-medium text-primary hover:underline">
                            {t('dashboard.viewAll')}
                        </Link>
                    }
                >
                    {blood.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-ink-gray">{t('blood.empty')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {blood.map((b) => (
                                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                                    <BloodBadge group={b.blood_group} />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-primary break-words">
                                            {b.patient_name} · {b.units} {t('blood.units')}
                                        </p>
                                        <p className="text-xs text-ink-gray">
                                            {[b.hospital, b.city].filter(Boolean).join(', ')}
                                            {b.needed_by && ` · ${t('blood.neededBy')}: ${date(b.needed_by, locale)}`}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}
