import { ChevronLeft, ChevronRight, Clock, HandCoins, MapPin, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { EventRowMenu, NewEventButton } from '@/components/calendar/event-controls';
import PageHeader from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { EVENT_TYPES, listGroupOptions, listMonth, resolveMonth } from '@/lib/events';
import { date as fmtDate, time as fmtTime } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageEvents } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('calendar.title') };
}

// Tint + text pairs, every text ≥4.5:1 on its tint. Fundraise is orange-state with navy text
// (white or orange text on orange fails, DESIGN.md §2).
const TYPE_CHIP = {
    event: 'bg-brand-navy/10 text-brand-navy',
    meeting: 'bg-blue-50 text-blue-800',
    festival: 'bg-purple-50 text-purple-800',
    other: 'bg-surface-bggray text-ink-gray',
    fundraise: 'bg-orange-100 text-brand-navy',
};
const TYPE_TONE = { event: 'navy', meeting: 'blue', festival: 'purple', other: 'gray', fundraise: 'orange' };

const pad = (n) => String(n).padStart(2, '0');
const monthHref = (key, currentKey) => (key === currentKey ? '/calendar' : `/calendar?m=${key}`);

export default async function CalendarPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const cal = resolveMonth(sp);
    const manager = canManageEvents(user.role);

    const [{ events, campaigns }, groups] = await Promise.all([
        listMonth(cal.first, cal.last),
        manager ? listGroupOptions() : Promise.resolve([]),
    ]);

    const months = t('calendar.months').split(',');
    const weekdays = t('calendar.weekdays').split(',');

    // One list of "items" with an inclusive [start, end] range, events and fundraise windows alike.
    const items = [
        ...events.map((e) => ({
            key: `e${e.id}`,
            kind: 'event',
            type: e.event_type,
            title: localized(e, 'title', locale),
            start: e.start_date,
            end: e.end_date || e.start_date,
            time: e.start_time,
            location: e.location,
            group: e.group_name ? localized({ name: e.group_name, name_gu: e.group_name_gu }, 'name', locale) : '',
            description: e.description,
            raw: e,
        })),
        ...campaigns.map((c) => ({
            key: `c${c.id}`,
            kind: 'fundraise',
            type: 'fundraise',
            title: localized(c, 'title', locale),
            start: c.start_date,
            end: c.end_date || c.start_date,
            href: `/fundraise/${c.id}`,
            status: c.status,
        })),
    ].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (a.time ?? '') < (b.time ?? '') ? -1 : 1));

    const cells = [];
    for (let i = 0; i < cal.firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= cal.days; d++) {
        const iso = `${cal.key}-${pad(d)}`;
        cells.push({ d, iso, weekday: (cal.firstWeekday + d - 1) % 7, items: items.filter((it) => it.start <= iso && it.end >= iso) });
    }
    while (cells.length % 7) cells.push(null);

    const navBtn = 'inline-flex size-9 items-center justify-center rounded-md border border-surface-border bg-white text-primary hover:bg-accent';
    const defaultDate = cal.key === cal.currentKey ? cal.today : cal.first;

    return (
        <div>
            <PageHeader
                title={t('calendar.title')}
                subtitle={t('calendar.subtitle')}
                actions={manager ? <NewEventButton groups={groups} types={EVENT_TYPES} defaultDate={defaultDate} /> : null}
            />

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link href={monthHref(cal.prev, cal.currentKey)} scroll={false} aria-label={t('common.prev')} className={navBtn}>
                    <ChevronLeft className="size-4" />
                </Link>
                <Link href={monthHref(cal.next, cal.currentKey)} scroll={false} aria-label={t('common.next')} className={navBtn}>
                    <ChevronRight className="size-4" />
                </Link>
                <h2 className="ml-1 text-base font-semibold text-primary tabular-nums">
                    {months[cal.month - 1]} {cal.year}
                </h2>
                {cal.key !== cal.currentKey && (
                    <Link
                        href="/calendar"
                        scroll={false}
                        className="ml-auto inline-flex h-9 items-center rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                    >
                        {t('calendar.today')}
                    </Link>
                )}
            </div>

            {/* Month grid — hidden below sm, where seven columns are ~48px each and unreadable. */}
            <div className="hidden overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm sm:block">
                <div className="grid grid-cols-7 border-b border-surface-border bg-surface-login">
                    {weekdays.map((w, i) => (
                        <div
                            key={w}
                            className={`px-2 py-2 text-[11px] font-semibold uppercase tracking-wide ${i === 0 ? 'text-destructive' : 'text-ink-gray'}`}
                        >
                            {w}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((c, i) => (
                        <div
                            key={c ? c.iso : `x${i}`}
                            className={`min-h-24 min-w-0 border-b border-r border-surface-border p-1 [&:nth-child(7n)]:border-r-0 ${
                                c ? '' : 'bg-surface-login/60'
                            }`}
                        >
                            {c && (
                                <>
                                    <span
                                        className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                                            c.iso === cal.today
                                                ? 'bg-primary text-primary-foreground'
                                                : c.weekday === 0
                                                  ? 'text-destructive'
                                                  : 'text-ink-gray'
                                        }`}
                                    >
                                        {c.d}
                                    </span>
                                    <div className="space-y-0.5">
                                        {c.items.slice(0, 3).map((it) => {
                                            // Label only where a bar begins (its start, a Sunday, or the 1st) — elsewhere it continues.
                                            const showLabel = it.start === c.iso || c.weekday === 0 || c.d === 1;
                                            const chip = `block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_CHIP[it.type]}`;
                                            const label = showLabel ? it.title : ' ';
                                            return it.href ? (
                                                <Link key={it.key} href={it.href} title={it.title} className={`${chip} hover:underline`}>
                                                    {label}
                                                </Link>
                                            ) : (
                                                <span key={it.key} title={it.title} className={chip}>
                                                    {showLabel && it.time && <span className="tabular-nums">{fmtTime(it.time)} </span>}
                                                    {label}
                                                </span>
                                            );
                                        })}
                                        {c.items.length > 3 && (
                                            <span className="block px-1.5 text-[11px] text-ink-gray">+{c.items.length - 3}</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Agenda — the primary view on phones, the detail view below the grid elsewhere. */}
            <section className="mt-4 overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                {items.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink-gray">{t('calendar.noEvents')}</p>
                ) : (
                    <ul className="divide-y divide-surface-border">
                        {items.map((it) => (
                            <li key={it.key} className="flex items-start gap-3 px-4 py-3">
                                <div className="w-14 shrink-0 rounded-md bg-accent py-1 text-center">
                                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">{fmtDate(it.start, locale).split(' ')[1]}</p>
                                    <p className="text-base font-semibold text-primary tabular-nums">{Number(it.start.slice(8, 10))}</p>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {it.href ? (
                                            <Link href={it.href} className="font-medium text-primary break-words hover:underline">
                                                {it.title}
                                            </Link>
                                        ) : (
                                            <span className="font-medium text-primary break-words">{it.title}</span>
                                        )}
                                        <Badge tone={TYPE_TONE[it.type]}>
                                            {it.kind === 'fundraise' && <HandCoins className="size-3" />}
                                            {it.kind === 'fundraise' ? t('calendar.fundraiseWindow') : t(`calendar.types.${it.type}`)}
                                        </Badge>
                                    </div>
                                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-gray">
                                        {it.end !== it.start && (
                                            <span className="tabular-nums">
                                                {fmtDate(it.start, locale)} – {fmtDate(it.end, locale)}
                                            </span>
                                        )}
                                        {it.time && (
                                            <span className="inline-flex items-center gap-1 tabular-nums">
                                                <Clock className="size-3" /> {fmtTime(it.time)}
                                            </span>
                                        )}
                                        {it.location && (
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="size-3" /> {it.location}
                                            </span>
                                        )}
                                        {it.group && (
                                            <span className="inline-flex items-center gap-1">
                                                <UsersRound className="size-3" /> {it.group}
                                            </span>
                                        )}
                                    </p>
                                    {it.description && <p className="mt-1 whitespace-pre-line text-xs text-ink break-words">{it.description}</p>}
                                </div>
                                {manager && it.kind === 'event' && <EventRowMenu event={it.raw} groups={groups} types={EVENT_TYPES} />}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
