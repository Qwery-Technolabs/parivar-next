import { ArrowLeft } from 'lucide-react';
import ChipLink from '@/components/ui/chip-link';
import Link from 'next/link';
import GroupAvatar from '@/components/groups/group-avatar';
import PrintButton from '@/components/fundraise/print-button';
import { date, money } from '@/lib/format';
import MandalScheduleSheets from './mandal-schedule-sheets';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { getSettings, samajName } from '@/lib/settings';

/**
 * A Mandal's printout / PDF (server component, outside the app shell) — the app's and the public link's:
 * ALL schedules, or ONE (`selected` = a schedule id), and Everyone / Came only / Absent only (`show`) —
 * chosen with the chips on top; the sheets themselves are MandalScheduleSheets.
 * `schedules`: [{ e, sheet, forThem }] (lib/mandal `mandalSheets`).
 */
export default async function MandalPrint({
    campaign,
    schedules,
    selected = null,
    show = 'all',
    expenses = null,
    t,
    locale,
    backHref,
    basePath,
    keep = {},
    allToken = null,
    defaultShow = 'all',
}) {
    const brand = samajName(await getSettings('admin'), locale) || t('app.name');
    const shown = selected ? schedules.filter((s) => s.e.id === selected) : schedules;
    const href = (sched, sh) => {
        // `keep`: other filters the links carry along (the public link's date range).
        const q = new URLSearchParams(sched ? {} : keep);
        // "All schedules": no parameter (the app), or `allToken` where no parameter means the latest (public link).
        if (sched) q.set('schedule', String(sched));
        else if (allToken) q.set('schedule', allToken);
        if (sh !== defaultShow) q.set('show', sh);
        return q.size ? `${basePath}?${q}` : basePath;
    };
    const chip = (on) =>
        `inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white text-ink-gray hover:text-primary'}`;
    return (
        <div className="min-h-dvh bg-surface-login print:bg-white">
            <style>{'@page { size: A4; margin: 12mm; } @media print { body { font-size: 11px; } }'}</style>
            <div className="no-print sticky top-0 z-10 border-b border-surface-border bg-white">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2">
                    <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        <ArrowLeft className="size-4" /> {t('common.back')}
                    </Link>
                    <PrintButton label={t('common.downloadPdf')} />
                </div>
                {/* What to print: everything, or one schedule (date). */}
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5 px-4 pb-2">
                    <span className="mr-1 text-xs font-medium text-ink-gray">{t('fundraise.printInclude')}</span>
                    <ChipLink href={href(null, show)} on={!selected} className={chip(!selected)}>
                        {t('mandal.printAll')}
                    </ChipLink>
                    {schedules.map(({ e }) => (
                        <ChipLink key={e.id} href={href(e.id, show)} on={selected === e.id} className={chip(selected === e.id)}>
                            {date(e.start_date, locale)}
                        </ChipLink>
                    ))}
                </div>
                {/* Whom to list: everyone, only those who came, or only the absent — a shorter printout. */}
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5 px-4 pb-2">
                    <span className="mr-1 text-xs font-medium text-ink-gray">{t('mandal.printShow')}</span>
                    {['all', 'present', 'absent'].map((k) => (
                        <ChipLink key={k} href={href(selected, k)} on={show === k} className={chip(show === k)}>
                            {t(k === 'all' ? 'mandal.printEveryone' : k === 'present' ? 'mandal.onlyPresent' : 'mandal.onlyAbsent')}
                        </ChipLink>
                    ))}
                </div>
            </div>
            <article className="theme-fundraise mx-auto my-4 max-w-4xl rounded-lg border border-surface-border bg-white p-6 shadow-sm print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8">
                <header className="mb-5 flex items-start gap-3 border-b-2 border-primary pb-3">
                    <GroupAvatar
                        id={campaign.id}
                        name={campaign.title}
                        kind={campaign.meta?.avatar_kind}
                        value={campaign.meta?.avatar_value}
                        color={campaign.meta?.avatar_color}
                        size="lg"
                        className="mt-1"
                    />
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">
                            {brand} · {t('mandal.badge')}
                        </p>
                        <h1 className="mt-1 text-lg font-semibold text-primary break-words">{localized(campaign, 'title', locale)}</h1>
                        <p className="mt-0.5 text-xs text-ink-gray">{t('fundraise.generatedOn', { date: date(todayLocal(), locale) })}</p>
                    </div>
                </header>

                <MandalScheduleSheets shown={shown} show={show} t={t} locale={locale} />
                {/* The money spent — at the chosen schedule, or all of it. */}
                {expenses && <MandalExpenses rows={expenses} t={t} locale={locale} />}
            </article>
        </div>
    );
}

/** Expenses under the sheets: date, what (category), amount, and the total. */
function MandalExpenses({ rows, t, locale }) {
    const total = rows.reduce((a, r) => a + Number(r.amount), 0);
    return (
        <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.expenses')}</h2>
            {rows.length === 0 ? (
                <p className="text-sm text-ink-gray">{t('fundraise.noExpenses')}</p>
            ) : (
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-gray">
                            <th className="w-28 py-1.5 pr-2 font-medium">{t('fundraise.spentOn')}</th>
                            <th className="py-1.5 pr-2 font-medium">{t('fundraise.expenseWhat')}</th>
                            <th className="w-28 py-1.5 text-right font-medium">{t('fundraise.amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-b border-surface-border/60">
                                <td className="py-1.5 pr-2 text-ink-gray tabular-nums">{date(r.spent_on, locale)}</td>
                                <td className="py-1.5 pr-2 text-primary">
                                    {r.title}
                                    {r.category && <span className="text-ink-gray"> · {r.category}</span>}
                                </td>
                                <td className="py-1.5 text-right font-medium text-expense tabular-nums">{money(r.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-primary font-semibold">
                            <td />
                            <td className="py-1.5 pr-2 text-primary">{t('common.total')}</td>
                            <td className="py-1.5 text-right text-expense tabular-nums">{money(total)}</td>
                        </tr>
                    </tfoot>
                </table>
            )}
        </section>
    );
}
