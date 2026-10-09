'use client';
import { Filter, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Popover } from '@/components/ui/popover';
import { textInput } from '@/components/ui/field';
import { mandalQuery } from '@/lib/mandal-filters';
import ScheduleSelect from './schedule-select';
import { useT } from '@/lib/i18n/client';

/**
 * One "Filter" button for a Mandal's public page: a pop-over with Schedule (one date, or empty = all) and,
 * for all, a From–To range. Applied in the URL (shareable; the PDF link carries it) with a mini loader on
 * Apply until the new view arrives. The page opens on the latest schedule (lib/mandal-filters).
 * `selected`: the schedule shown now (the latest one by default); `filters.show` is kept.
 * @param {{ basePath: string, schedules: Array<{ id: number, label: string, hint?: string }>, filters: object, selected: number|null }} props
 */
export default function MandalFilterButton({ basePath, schedules, filters, selected }) {
    const { t } = useT();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const active = selected ? 1 : [filters.from, filters.to].filter(Boolean).length;
    const go = (q) => startTransition(() => router.push(q ? `${basePath}?${q}` : basePath, { scroll: false }));
    const apply = (e, close) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const schedule = Number(fd.get('schedule')) || null;
        const day = (k) => String(fd.get(k) ?? '');
        go(mandalQuery({ all: !schedule, schedule, from: schedule ? '' : day('from'), to: schedule ? '' : day('to'), show: filters.show }));
        close();
    };
    return (
        <Popover
            align="right"
            width="w-72"
            role="dialog"
            trigger={({ open, toggle, id }) => (
                // Icon only, in the same blue as the PDF button beside it; the label stays as tooltip and
                // screen-reader name, and an orange count sits on the corner while a filter is applied.
                <button
                    id={id}
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label={t('common.filters')}
                    title={t('common.filters')}
                    className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
                    {active > 0 && !pending && (
                        <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-orange text-[10px] font-semibold text-white tabular-nums">
                            {active}
                        </span>
                    )}
                </button>
            )}
        >
            {(close) => (
                <form onSubmit={(e) => apply(e, close)} className="space-y-3 p-3">
                    {/* A schedule — searchable by date or place, the place under each date; empty = all. */}
                    <div>
                        <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.schedule')}</span>
                        <ScheduleSelect
                            name="schedule"
                            options={schedules.map((x) => ({ value: x.id, label: x.label, hint: x.hint }))}
                            defaultValue={selected ?? ''}
                            allowEmpty
                            emptyLabel={t('mandal.printAllShort')}
                        />
                    </div>
                    {/* Or a date range (used when no schedule is chosen). */}
                    <div className="grid grid-cols-2 gap-2">
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.from')}</span>
                            <input type="date" name="from" defaultValue={filters.from} className={`${textInput()} w-full`} />
                        </label>
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.to')}</span>
                            <input type="date" name="to" defaultValue={filters.to} className={`${textInput()} w-full`} />
                        </label>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        {/* Back to the default view: the latest schedule. */}
                        <button
                            type="button"
                            onClick={() => {
                                go(mandalQuery({ show: filters.show }));
                                close();
                            }}
                            className="inline-flex h-9 items-center px-2 text-sm font-medium text-primary hover:underline"
                        >
                            {t('common.clear')}
                        </button>
                        <button
                            type="submit"
                            disabled={pending}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                            {pending && <Loader2 className="size-4 animate-spin" />}
                            {t('common.apply')}
                        </button>
                    </div>
                </form>
            )}
        </Popover>
    );
}
