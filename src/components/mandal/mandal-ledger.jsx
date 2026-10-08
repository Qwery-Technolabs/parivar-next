import { FileDown } from 'lucide-react';
import Link from 'next/link';
import { date, money } from '@/lib/format';

/**
 * A Mandal's public ledger (server component) — the /p/[token] page and its PDF: income and
 * expenses for ALL, ONE schedule, or a custom date range, each grouped BY DATE (a heading per day,
 * the entries, the day's total), then the grand totals. Anonymous gifts stay anonymous.
 * `filters`: { schedule, from, to }; `basePath`: the page the filter form submits to; `printHref`:
 * the PDF of the same filter (omitted on the printout itself, which shows no form).
 */
export default function MandalLedger({ ledger, filters, t, locale, basePath, printHref = null }) {
    const { schedules, incomes, expenses } = ledger;
    const byDay = (rows, dayOf) => {
        const map = new Map();
        for (const r of rows) {
            const d = String(dayOf(r) ?? '').slice(0, 10);
            map.set(d, [...(map.get(d) ?? []), r]);
        }
        return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    };
    const incomeTotal = incomes.reduce((s, r) => s + Number(r.amount), 0);
    const expenseTotal = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const donor = (r) => (r.is_anonymous ? t('fundraise.anonymousLabel') : r.donor_name);
    const label = (s) => `${date(s.start_date, locale)} - ${t('mandal.word')}`;
    const filtered = Boolean(filters.schedule || filters.from || filters.to);

    const block = (title, groups, total, tone, line) => (
        <section className="space-y-3">
            <h2 className="flex items-baseline justify-between gap-3 border-b-2 border-primary pb-1 text-sm font-semibold text-primary">
                <span>{title}</span>
                <span className={`tabular-nums ${tone}`}>{money(total)}</span>
            </h2>
            {groups.length === 0 ? (
                <p className="text-sm text-ink-gray">{t('mandal.ledgerNone')}</p>
            ) : (
                groups.map(([day, rows]) => (
                    <div key={day} className="mandal-day">
                        <div className="flex items-baseline justify-between gap-3 rounded bg-card-head px-2 py-1 text-xs font-semibold text-primary">
                            <span>{date(day, locale)}</span>
                            <span className={`tabular-nums ${tone}`}>{money(rows.reduce((s, r) => s + Number(r.amount), 0))}</span>
                        </div>
                        <ul className="divide-y divide-surface-border/60 text-sm">{rows.map(line)}</ul>
                    </div>
                ))
            )}
        </section>
    );

    return (
        <div className="space-y-5">
            {printHref !== null && (
                // What to show: everything, one schedule, or a date range (GET — the URL is shareable).
                <form action={basePath} className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-surface-border bg-white p-3 shadow-sm">
                    <label className="block min-w-0">
                        <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.schedule')}</span>
                        <select
                            name="schedule"
                            defaultValue={filters.schedule ?? ''}
                            className="h-9 rounded-md border border-surface-border bg-white pl-2.5 pr-8 text-sm text-primary"
                        >
                            <option value="">{t('mandal.printAllShort')}</option>
                            {schedules.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {label(s)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.from')}</span>
                        <input
                            type="date"
                            name="from"
                            defaultValue={filters.from}
                            className="h-9 rounded-md border border-surface-border bg-white px-2.5 text-sm text-primary"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-gray">{t('mandal.to')}</span>
                        <input
                            type="date"
                            name="to"
                            defaultValue={filters.to}
                            className="h-9 rounded-md border border-surface-border bg-white px-2.5 text-sm text-primary"
                        />
                    </label>
                    <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        {t('common.apply')}
                    </button>
                    {filtered && (
                        <Link href={basePath} className="inline-flex h-9 items-center px-1 text-sm font-medium text-primary hover:underline">
                            {t('common.clear')}
                        </Link>
                    )}
                    <Link
                        href={printHref}
                        className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                    >
                        <FileDown className="size-4" /> {t('common.downloadPdf')}
                    </Link>
                    <p className="w-full text-xs text-ink-gray">{t('mandal.ledgerFilterHint')}</p>
                </form>
            )}

            {block(
                t('fundraise.contributions'),
                byDay(incomes, (r) => r.paid_on),
                incomeTotal,
                'text-income',
                (r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-3 px-2 py-1.5">
                        <span className="min-w-0 break-words text-primary">{donor(r)}</span>
                        <span className="shrink-0 tabular-nums">
                            <span className="mr-2 text-xs text-ink-gray">{t(`fundraise.modes.${r.mode}`)}</span>
                            {money(r.amount)}
                        </span>
                    </li>
                ),
            )}

            {block(
                t('fundraise.expenses'),
                byDay(expenses, (x) => x.spent_on),
                expenseTotal,
                'text-expense',
                (x) => (
                    <li key={x.id} className="flex items-baseline justify-between gap-3 px-2 py-1.5">
                        <span className="min-w-0 break-words text-primary">{[x.title, x.place].filter(Boolean).join(' — ')}</span>
                        <span className="shrink-0 tabular-nums">{money(x.amount)}</span>
                    </li>
                ),
            )}

            <div className="flex items-baseline justify-between gap-3 rounded-md bg-card-head px-3 py-2 text-sm font-semibold">
                <span className="text-primary">{t('fundraise.balance')}</span>
                <span className={`tabular-nums ${incomeTotal - expenseTotal < 0 ? 'text-rose-700' : 'text-primary'}`}>{money(incomeTotal - expenseTotal)}</span>
            </div>
        </div>
    );
}
