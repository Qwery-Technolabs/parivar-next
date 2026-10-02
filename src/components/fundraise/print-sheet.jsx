import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { date } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import GroupAvatar from '@/components/groups/group-avatar';
import PrintButton from './print-button';
import Statement, { STATEMENT_SECTIONS } from './statement';
import { getSettings, samajName } from '@/lib/settings';

const SECTION_LABEL = { contributors: 'fundraise.byContributor', contributions: 'fundraise.contributions', expenses: 'fundraise.expenses' };

/**
 * A4 statement page. Rendered outside the app shell, because the shell's
 * h-dvh overflow-hidden frame would clip everything past the first printed page.
 */
export default async function PrintSheet({ campaign, contributors, contributions, expenses, t, locale, backHref, publicView, basePath, sections }) {
    // The Samaj name (Settings → General) heads the printout; the app name only when none is set.
    const brand = samajName(await getSettings('admin'), locale) || t('app.name');
    // Each chip links to the same page with that section switched on / off (at least one stays on).
    const toggled = (s) => {
        const next = sections.includes(s) ? sections.filter((x) => x !== s) : STATEMENT_SECTIONS.filter((x) => x === s || sections.includes(x));
        return next.length ? `${basePath}?show=${next.join(',')}` : null;
    };
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
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5 px-4 pb-2">
                    <span className="mr-1 text-xs font-medium text-ink-gray">{t('fundraise.printInclude')}</span>
                    {STATEMENT_SECTIONS.map((s) => {
                        const on = sections.includes(s);
                        const href = toggled(s);
                        const cls = `inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white text-ink-gray hover:text-primary'}`;
                        const body = (
                            <>
                                {on && <Check className="size-3.5" />}
                                {t(SECTION_LABEL[s])}
                            </>
                        );
                        return href ? (
                            <Link key={s} href={href} replace scroll={false} aria-pressed={on} className={cls}>
                                {body}
                            </Link>
                        ) : (
                            <span key={s} aria-pressed={on} className={cls}>
                                {body}
                            </span>
                        );
                    })}
                </div>
            </div>
            <article className="theme-fundraise mx-auto my-4 max-w-4xl rounded-lg border border-surface-border bg-white p-6 shadow-sm print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8">
                <header className="mb-5 flex items-start gap-3 border-b-2 border-primary pb-3">
                    {/* The fundraise's picture, as in the app and on the public page. */}
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
                            {brand} · {t('fundraise.publicTitle')}
                        </p>
                        <h1 className="mt-1 text-lg font-semibold text-primary break-words">{localized(campaign, 'title', locale)}</h1>
                        <p className="mt-0.5 text-xs text-ink-gray">
                            {[groupName, campaign.location, dates, t('fundraise.generatedOn', { date: date(todayLocal(), locale) })]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                </header>
                <Statement
                    campaign={campaign}
                    contributors={contributors}
                    contributions={contributions}
                    expenses={expenses}
                    t={t}
                    locale={locale}
                    publicView={publicView}
                    sections={sections}
                />
                <p className="mt-6 text-center text-[11px] text-ink-gray">{t('fundraise.poweredBy')}</p>
            </article>
        </div>
    );
}
