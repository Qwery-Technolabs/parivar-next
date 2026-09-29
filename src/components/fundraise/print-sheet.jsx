import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { date } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import PrintButton from './print-button';
import Statement from './statement';

/**
 * A4 statement page. Rendered outside the app shell, because the shell's
 * h-dvh overflow-hidden frame would clip everything past the first printed page.
 */
export default function PrintSheet({ campaign, contributors, contributions, expenses, t, locale, backHref, publicView }) {
    const groupName = campaign.group_id ? localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale) : '';
    const dates = campaign.start_date || campaign.end_date ? `${date(campaign.start_date, locale)} – ${date(campaign.end_date, locale)}` : '';
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
            </div>
            <article className="theme-fundraise mx-auto my-4 max-w-4xl rounded-lg border border-surface-border bg-white p-6 shadow-sm print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8">
                <header className="mb-5 border-b-2 border-primary pb-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">
                        {t('app.name')} · {t('fundraise.publicTitle')}
                    </p>
                    <h1 className="mt-1 text-lg font-semibold text-primary break-words">{localized(campaign, 'title', locale)}</h1>
                    <p className="mt-0.5 text-xs text-ink-gray">
                        {[groupName, campaign.location, dates, t('fundraise.generatedOn', { date: date(todayLocal(), locale) })].filter(Boolean).join(' · ')}
                    </p>
                </header>
                <Statement
                    campaign={campaign}
                    contributors={contributors}
                    contributions={contributions}
                    expenses={expenses}
                    t={t}
                    locale={locale}
                    publicView={publicView}
                />
                <p className="mt-6 text-center text-[11px] text-ink-gray">{t('fundraise.poweredBy')}</p>
            </article>
        </div>
    );
}
