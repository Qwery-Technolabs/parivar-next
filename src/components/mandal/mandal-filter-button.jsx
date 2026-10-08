'use client';
import { Filter } from 'lucide-react';
import Link from 'next/link';
import { Popover } from '@/components/ui/popover';
import { selectInput, textInput } from '@/components/ui/field';
import { useT } from '@/lib/i18n/client';

/**
 * One "Filter" button for a Mandal's public page: a pop-over with Schedule (all / one date) or a
 * From–To range, submitted as GET to `basePath` (the filter lives in the URL, so it is shareable and
 * the PDF link carries it). The badge counts what is applied.
 * @param {{ basePath: string, schedules: Array<{ id: number, label: string }>, filters: { schedule: number|null, from: string, to: string } }} props
 */
export default function MandalFilterButton({ basePath, schedules, filters }) {
    const { t } = useT();
    const active = filters.schedule ? 1 : [filters.from, filters.to].filter(Boolean).length;
    return (
        <Popover
            align="right"
            width="w-72"
            role="dialog"
            trigger={({ open, toggle, id }) => (
                <button
                    id={id}
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className="btn-secondary inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium"
                >
                    <Filter className="size-4" /> {t('common.filters')}
                    {active > 0 && (
                        <span className="rounded-full bg-brand-orange px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">{active}</span>
                    )}
                </button>
            )}
        >
            {() => (
                <form action={basePath} className="space-y-3 p-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.schedule')}</span>
                        <select name="schedule" defaultValue={filters.schedule ?? ''} className={`${selectInput()} w-full`}>
                            <option value="">{t('mandal.printAllShort')}</option>
                            {schedules.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
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
                        {active > 0 && (
                            <Link href={basePath} className="inline-flex h-9 items-center px-2 text-sm font-medium text-primary hover:underline">
                                {t('common.clear')}
                            </Link>
                        )}
                        <button
                            type="submit"
                            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            {t('common.apply')}
                        </button>
                    </div>
                </form>
            )}
        </Popover>
    );
}
