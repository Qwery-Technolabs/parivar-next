import { Cake, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Circle, Clock, HandCoins, MapPin, PartyPopper, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { EventRowMenu, NewEventButton } from '@/components/calendar/event-controls';
import PageHeader from '@/components/shell/page-header';
import FilterBar from '@/components/ui/filter-bar';
import Badge from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { EVENT_TYPES, listGroupOptions, listMonth, resolveMonth, listBirthdays } from '@/lib/events';
import { date as fmtDate, time as fmtTime } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageEvents, ROLES } from '@/lib/roles';
import { sp1 } from '@/lib/url';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('calendar.title') };
}

// Tint + text pairs, every text ≥4.5:1 on its tint. Fundraise is orange-state with navy text
// (white or orange text on orange fails, design-system.md §2).
const TYPE_CHIP = {
    event: 'bg-brand-navy/10 text-brand-navy',
    meeting: 'bg-blue-50 text-blue-800',
    festival: 'bg-purple-50 text-purple-800',
    other: 'bg-surface-bggray text-ink-gray',
    fundraise: 'bg-orange-100 text-brand-navy',
    birthday: 'bg-rose-50 text-rose-700',
};
// An icon per kind, shown before the title in the grid and the agenda.
const TYPE_ICON = { event: CalendarDays, meeting: CalendarClock, festival: PartyPopper, other: Circle, fundraise: HandCoins, birthday: Cake };
// Solid dots for the phone grid (one per kind on that day).
const TYPE_DOT = {
    event: 'bg-brand-navy',
    meeting: 'bg-blue-600',
    festival: 'bg-purple-600',
    other: 'bg-ink-gray',
    fundraise: 'bg-brand-orange',
    birthday: 'bg-rose-500',
};
const TYPE_TONE = { event: 'navy', meeting: 'blue', festival: 'purple', other: 'gray', fundraise: 'orange', birthday: 'red' };

const pad = (n) => String(n).padStart(2, '0');
const monthHref = (key, currentKey) => (key === currentKey ? '/calendar' : `/calendar?m=${key}`);

export default async function CalendarPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const cal = resolveMonth(sp);
    // Filters: what to show (all = absence) and, for birthdays, whose (an app role).
    const SHOW = ['birthday', 'meeting', 'fundraise', 'event', 'festival'];
    const show = SHOW.includes(sp1(sp.show)) ? sp1(sp.show) : '';
    const brole = ROLES.includes(sp1(sp.brole)) ? sp1(sp.brole) : '';
    const wants = (type) => !show || show === type;
    const manager = canManageEvents(user.role);

    const [{ events, campaigns }, groups, birthdays] = await Promise.all([
        listMonth(cal.first, cal.last),
        manager ? listGroupOptions() : Promise.resolve([]),
        wants('birthday') ? listBirthdays(cal.year, cal.month, cal.days, brole) : Promise.resolve([]),
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
            group: e.group_name ? localized({ name: e.group_name, name_local: e.group_name_local }, 'name', locale) : '',
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
        // Members' birthdays this month (day only; the year is theirs).
        ...birthdays.map((b) => {
            const iso = `${cal.key}-${pad(b.day)}`;
            return {
                key: `b${b.id}`,
                kind: 'birthday',
                type: 'birthday',
                title: localized(b, 'full_name', locale),
                start: iso,
                end: iso,
                href: `/members/${b.id}`,
                turns: b.turns,
            };
        }),
    ]
        .filter((it) => wants(it.type))
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (a.time ?? '') < (b.time ?? '') ? -1 : 1));

    const cells = [];
    for (let i = 0; i < cal.firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= cal.days; d++) {
        const iso = `${cal.key}-${pad(d)}`;
        cells.push({ d, iso, weekday: (cal.firstWeekday + d - 1) % 7, items: items.filter((it) => it.start <= iso && it.end >= iso) });
    }
    while (cells.length % 7) cells.push(null);

    const navBtn = 'inline-flex size-9 items-center justify-center rounded-md btn-secondary';
    const defaultDate = cal.key === cal.currentKey ? cal.today : cal.first;

    return (
        <div>
            <PageHeader
                title={t('calendar.title')}
                subtitle={t('calendar.subtitle')}
                actions={manager ? <NewEventButton groups={groups} types={EVENT_TYPES} defaultDate={defaultDate} /> : null}
            />

            {/* One row: month navigation on the left, Filters on the right. */}
            <FilterBar
                left={
                    <>
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
                                className="inline-flex h-9 items-center rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                            >
                                {t('calendar.today')}
                            </Link>
                        )}
                    </>
                }
                filters={[
                    {
                        param: 'show',
                        label: t('calendar.filters.show'),
                        type: 'select',
                        allLabel: t('calendar.filters.everything'),
                        options: SHOW.map((v) => ({ value: v, label: t(`calendar.filters.${v}`) })),
                    },
                    {
                        param: 'brole',
                        label: t('calendar.filters.birthdayRole'),
                        type: 'select',
                        allLabel: t('common.any'),
                        options: ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) })),
                        // Only while birthdays are shown (everything, or birthdays only).
                        showIf: { param: 'show', in: ['', 'birthday'] },
                    },
                ]}
            />

            {/* Phone month grid: seven ~48px columns have no room for titles, so each day shows its
                number and a coloured dot per kind; tapping a day jumps to it in the list below. */}
            <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm sm:hidden">
                <div className="grid grid-cols-7 border-b border-surface-border bg-surface-login">
                    {weekdays.map((w, i) => (
                        <div key={w} className={`truncate px-0.5 py-1.5 text-center text-[10px] font-semibold uppercase ${i === 0 ? 'text-destructive' : 'text-ink-gray'}`}>
                            {w}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((c, i) => {
                        if (!c) return <div key={`p${i}`} className="h-12 border-b border-r border-surface-border bg-surface-login/60 [&:nth-child(7n)]:border-r-0" />;
                        const kinds = [...new Set(c.items.map((it) => it.type))].slice(0, 4);
                        const body = (
                            <>
                                <span
                                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                                        c.iso === cal.today ? 'seg-active' : c.weekday === 0 ? 'text-destructive' : 'text-ink'
                                    }`}
                                >
                                    {c.d}
                                </span>
                                <span className="flex h-1.5 items-center gap-0.5">
                                    {kinds.map((k) => (
                                        <span key={k} className={`size-1.5 rounded-full ${TYPE_DOT[k] ?? TYPE_DOT.other}`} />
                                    ))}
                                </span>
                            </>
                        );
                        const cell = 'flex h-12 flex-col items-center justify-center gap-0.5 border-b border-r border-surface-border [&:nth-child(7n)]:border-r-0';
                        return c.items.length ? (
                            <a key={c.iso} href={`#ag-${c.items[0].key}`} aria-label={`${c.d}: ${c.items.map((it) => it.title).join(', ')}`} className={`${cell} hover:bg-accent`}>
                                {body}
                            </a>
                        ) : (
                            <div key={c.iso} className={cell}>
                                {body}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Month grid (sm and up), with titles in the cells. */}
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
                                                ? 'seg-active'
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
                                            const Icon = TYPE_ICON[it.type] ?? Circle;
                                            const icon = showLabel && <Icon aria-hidden className="mr-1 inline size-3 -translate-y-px" />;
                                            return it.href ? (
                                                <Link key={it.key} href={it.href} title={it.title} className={`${chip} hover:underline`}>
                                                    {icon}
                                                    {label}
                                                </Link>
                                            ) : (
                                                <span key={it.key} title={it.title} className={chip}>
                                                    {icon}
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

            {/* Agenda — the details for the month, below the grid (phones jump here from a day). */}
            <section className="mt-4 overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                {items.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink-gray">{t('calendar.noEvents')}</p>
                ) : (
                    <ul className="divide-y divide-surface-border">
                        {items.map((it) => (
                            <li key={it.key} id={`ag-${it.key}`} className="flex scroll-mt-4 items-start gap-3 px-4 py-3 target:bg-accent">
                                <div className="w-14 shrink-0 rounded-md bg-accent py-1 text-center">
                                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">{fmtDate(it.start, locale).split(' ')[1]}</p>
                                    <p className="text-base font-semibold text-primary tabular-nums">{Number(it.start.slice(8, 10))}</p>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(() => {
                                            const Icon = TYPE_ICON[it.type] ?? Circle;
                                            return (
                                                <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full ${TYPE_CHIP[it.type]}`}>
                                                    <Icon className="size-3.5" />
                                                </span>
                                            );
                                        })()}
                                        {it.href ? (
                                            <Link href={it.href} className="font-medium text-primary break-words hover:underline">
                                                {it.title}
                                            </Link>
                                        ) : (
                                            <span className="font-medium text-primary break-words">{it.title}</span>
                                        )}
                                        <Badge tone={TYPE_TONE[it.type]}>
                                            {it.kind === 'fundraise'
                                                ? t('calendar.fundraiseWindow')
                                                : it.kind === 'birthday'
                                                  ? t('calendar.birthday')
                                                  : t(`calendar.types.${it.type}`)}
                                        </Badge>
                                        {it.kind === 'birthday' && it.turns > 0 && (
                                            <span className="text-xs text-ink-gray">{t('calendar.turns', { age: it.turns })}</span>
                                        )}
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
