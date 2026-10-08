import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import PrintButton from '@/components/fundraise/print-button';
import GroupAvatar from '@/components/groups/group-avatar';
import { date } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { getSettings, samajName } from '@/lib/settings';
import MandalLedger from './mandal-ledger';

/**
 * The public Mandal ledger as an A4 printout / PDF (/p/[token]/print) — the same filter as the page
 * (all, one schedule, or a date range), named under the title. Outside any app shell.
 */
export default async function MandalLedgerPrint({ campaign, ledger, filters, t, locale, backHref }) {
    const brand = samajName(await getSettings('admin'), locale) || t('app.name');
    const chosen = filters.schedule ? ledger.schedules.find((s) => s.id === filters.schedule) : null;
    const period = chosen
        ? `${date(chosen.start_date, locale)} - ${t('mandal.word')}`
        : filters.from || filters.to
          ? `${filters.from ? date(filters.from, locale) : '…'} – ${filters.to ? date(filters.to, locale) : '…'}`
          : t('mandal.printAllShort');
    return (
        <div className="min-h-dvh bg-surface-login print:bg-white">
            <style>{'@page { size: A4; margin: 12mm; } @media print { body { font-size: 11px; } .mandal-day { break-inside: avoid; } }'}</style>
            <div className="no-print sticky top-0 z-10 border-b border-surface-border bg-white">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2">
                    <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        <ArrowLeft className="size-4" /> {t('common.back')}
                    </Link>
                    <PrintButton label={t('common.downloadPdf')} />
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
                        <p className="mt-0.5 text-xs text-ink-gray">
                            {period} · {t('fundraise.generatedOn', { date: date(todayLocal(), locale) })}
                        </p>
                    </div>
                </header>
                <MandalLedger ledger={ledger} filters={filters} t={t} locale={locale} basePath="" />
            </article>
        </div>
    );
}
