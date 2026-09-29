'use client';
import { Cake, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { time as fmtTime } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Month grid of meetings. Days with meetings show their titles (a dot on a phone, where a
 * 7-column grid has no room for text); choosing a day hands its meetings to `renderDay`,
 * which draws the same cards as the list view below the grid.
 * Birthdays (month/day) are placed in whichever month is showing, as cake chips.
 * @param {{ meetings: any[], birthdays?: any[], today: string, renderDay: (day: string, meetings: any[], birthdays: any[]) => React.ReactNode }} props
 */
export default function MeetingCalendar({ meetings, birthdays = [], today, renderDay }) {
    const { t, locale } = useT();
    // Start on the month of the next meeting, else this month.
    const firstUpcoming = [...meetings].filter((m) => m.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const [month, setMonth] = useState((firstUpcoming?.start_date ?? today).slice(0, 7));
    const [selected, setSelected] = useState(firstUpcoming?.start_date ?? today);

    const [y, mo] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1));
    const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const lead = first.getUTCDay(); // Sunday-first, like the main calendar
    const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${pad(i + 1)}`)];
    while (cells.length % 7) cells.push(null);

    const byDay = {};
    for (const m of meetings) (byDay[m.start_date] ??= []).push(m);
    for (const d of Object.keys(byDay)) byDay[d].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    // This month's birthdays; 29 February lands on the 28th in a non-leap year.
    const bdayByDay = {};
    for (const b of birthdays) {
        if (b.month !== mo || b.born > y) continue;
        const day = `${month}-${pad(Math.min(b.day, daysIn))}`;
        (bdayByDay[day] ??= []).push({ ...b, turns: y - b.born });
    }

    const shift = (n) => {
        const d = new Date(Date.UTC(y, mo - 1 + n, 1));
        setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    };
    const months = t('calendar.months').split(',');
    const weekdays = t('calendar.weekdays').split(',');
    const title = (m) => (locale !== 'en' && m.title_local) || m.title;

    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-surface-border bg-card-head px-2 py-1.5">
                    <button type="button" onClick={() => shift(-1)} aria-label={t('common.prev')} className="flex size-8 items-center justify-center rounded-md text-primary hover:bg-white">
                        <ChevronLeft className="size-4" />
                    </button>
                    <p className="text-sm font-semibold text-primary">
                        {months[mo - 1]} {y}
                    </p>
                    <button type="button" onClick={() => shift(1)} aria-label={t('common.next')} className="flex size-8 items-center justify-center rounded-md text-primary hover:bg-white">
                        <ChevronRight className="size-4" />
                    </button>
                </div>
                <div className="grid grid-cols-7 border-b border-surface-border bg-surface-login">
                    {weekdays.map((w) => (
                        <p key={w} className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-gray">
                            {w}
                        </p>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((d, i) => {
                        if (!d) return <div key={`x${i}`} className="min-h-12 border-b border-r border-surface-border bg-surface-login/40 sm:min-h-20" />;
                        const list = byDay[d] ?? [];
                        const bdays = bdayByDay[d] ?? [];
                        const isSel = d === selected;
                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setSelected(d)}
                                aria-pressed={isSel}
                                aria-label={`${d}${list.length ? ` · ${list.length}` : ''}`}
                                className={`flex min-h-12 min-w-0 flex-col items-stretch gap-0.5 border-b border-r border-surface-border p-1 text-left sm:min-h-20 ${
                                    isSel ? 'bg-orange-50' : 'hover:bg-accent/60'
                                }`}
                            >
                                <span
                                    className={`flex size-6 items-center justify-center self-start rounded-full text-xs font-medium tabular-nums ${
                                        d === today ? 'seg-active' : 'text-primary'
                                    }`}
                                >
                                    {Number(d.slice(8))}
                                </span>
                                {/* Phone: a dot per day with meetings. Wider: the titles themselves. */}
                                {(list.length > 0 || bdays.length > 0) && (
                                    <span className="mx-auto flex gap-0.5 sm:hidden" aria-hidden>
                                        {list.length > 0 && <span className="size-1.5 rounded-full bg-brand-orange-strong" />}
                                        {bdays.length > 0 && <span className="size-1.5 rounded-full bg-rose-500" />}
                                    </span>
                                )}
                                <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                                    {list.slice(0, 2).map((m) => (
                                        <span key={m.id} className="truncate rounded bg-accent px-1 text-[11px] font-medium text-primary">
                                            {m.start_time ? `${fmtTime(m.start_time)} ` : ''}
                                            {title(m)}
                                        </span>
                                    ))}
                                    {list.length > 2 && <span className="text-[10px] text-ink-gray">+{list.length - 2}</span>}
                                    {bdays.slice(0, 2).map((b) => (
                                        <span key={`b${b.id}`} className="truncate rounded bg-rose-50 px-1 text-[11px] font-medium text-rose-700">
                                            <Cake aria-hidden className="mr-0.5 inline size-3 -translate-y-px" />
                                            {(locale !== 'en' && b.nameLocal) || b.name}
                                        </span>
                                    ))}
                                    {bdays.length > 2 && <span className="text-[10px] text-rose-700">+{bdays.length - 2}</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {renderDay(selected, byDay[selected] ?? [], bdayByDay[selected] ?? [])}
        </div>
    );
}
