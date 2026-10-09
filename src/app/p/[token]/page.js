import { FileDown } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FundraiseSummary from '@/components/fundraise/summary';
import GroupAvatar from '@/components/groups/group-avatar';
import Statement from '@/components/fundraise/statement';
import MandalFilterButton from '@/components/mandal/mandal-filter-button';
import Badge from '@/components/ui/badge';
import { date } from '@/lib/format';
import { contributorTotals, getCampaignByToken, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import MandalScheduleSheets from '@/components/mandal/mandal-schedule-sheets';
import { todayLocal } from '@/lib/forms';
import { mandalLedger, mandalSheets, mandalStatement } from '@/lib/mandal';
import ChipLink from '@/components/ui/chip-link';
import { MANDAL_SHOWS, mandalFilters, mandalQuery } from '@/lib/mandal-filters';

// A leaked link must not be indexed; the committee can kill it with "New link".
export async function generateMetadata({ params }) {
    const { token } = await params;
    const { locale } = await getT();
    const c = await getCampaignByToken(token);
    return { title: c ? localized(c, 'title', locale) : undefined, robots: { index: false, follow: false } };
}

export default async function PublicFundraisePage({ params, searchParams }) {
    const { token } = await params;
    // The campaign and the texts load together.
    const [campaign, { t, locale }] = await Promise.all([getCampaignByToken(token), getT()]);
    if (!campaign) notFound();

    // A Mandal: by schedule — the latest one by default (those who came), or any one / all / a date range.
    const isMandal = campaign.kind === 'mandal';
    const filters = isMandal ? mandalFilters(await searchParams) : null;
    const today = todayLocal();
    const [plain, ledger, sheets] = await Promise.all([
        isMandal ? null : Promise.all([contributorTotals(campaign.id, { publicView: true }), listContributions(campaign.id), listExpenses(campaign.id)]),
        isMandal ? mandalLedger(campaign.id, filters, today) : null,
        // Its schedules' sheets (who came, who paid).
        isMandal ? mandalSheets(campaign, today, filters) : null,
    ]);
    // The schedule shown (the one asked for, else the latest); null = all (in the range).
    const selected = ledger?.schedule ?? null;
    const shownSheets = sheets && selected ? sheets.filter((x) => x.e.id === selected) : sheets;
    const showHref = (k) => {
        const q = mandalQuery(filters, { show: k, schedule: selected, all: !selected });
        return `/p/${token}${q ? `?${q}` : ''}`;
    };
    // A Mandal: the same three tables, from the filtered rows (totals follow the filter).
    const { contributors, contributions, expenses, shownCampaign } = isMandal
        ? mandalStatement(campaign, ledger)
        : { contributors: plain[0], contributions: plain[1], expenses: plain[2], shownCampaign: campaign };
    const pdfQuery = isMandal ? mandalQuery(filters, { schedule: selected, all: !selected }) : '';
    const query = pdfQuery ? `?${pdfQuery}` : '';
    const chip = (on) =>
        `inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white text-ink-gray hover:text-primary'}`;
    const groupName = campaign.group_id ? localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale) : '';
    const dates = campaign.start_date || campaign.end_date ? `${date(campaign.start_date, locale)} – ${date(campaign.end_date, locale)}` : '';

    return (
        <main className="theme-fundraise mx-auto max-w-4xl space-y-5 px-4 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                {/* The fundraise's picture beside its title, as inside the app. */}
                <div className="flex min-w-0 items-start gap-3">
                    <GroupAvatar
                        id={campaign.id}
                        name={campaign.title}
                        kind={campaign.meta.avatar_kind}
                        value={campaign.meta.avatar_value}
                        color={campaign.meta.avatar_color}
                        size="lg"
                        className="mt-1"
                    />
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.publicTitle')}</p>
                        <h1 className="mt-1 text-lg font-semibold text-primary break-words">{localized(campaign, 'title', locale)}</h1>
                        {(groupName || dates || campaign.location) && (
                            <p className="mt-0.5 text-xs text-ink-gray">{[groupName, campaign.location, dates].filter(Boolean).join(' · ')}</p>
                        )}
                    </div>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Badge status={campaign.status}>{t(`fundraise.${campaign.status}`)}</Badge>
                    {/* Icon only; the label stays as tooltip and screen-reader name. Download, then (a Mandal)
                        the filter at the far right. */}
                    <Link
                        href={`/p/${token}/print${query}`}
                        aria-label={t('common.downloadPdf')}
                        title={t('common.downloadPdf')}
                        className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 sm:ml-0"
                    >
                        <FileDown className="size-4" />
                    </Link>
                    {isMandal && (
                        <MandalFilterButton
                            basePath={`/p/${token}`}
                            filters={filters}
                            selected={selected}
                            schedules={ledger.schedules.map((s) => ({
                                id: s.id,
                                label: `${date(s.start_date, locale)} - ${t('mandal.word')}`,
                                hint: s.location || undefined,
                            }))}
                        />
                    )}
                </div>
            </div>

            <FundraiseSummary campaign={campaign} t={t} />

            {isMandal && (
                <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm sm:p-6">
                    {/* Whom to list — those who came (default), everyone, or the absent; a mini loader on the chip. */}
                    <div className="mb-4 flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs font-medium text-ink-gray">{t('mandal.printShow')}</span>
                        {MANDAL_SHOWS.map((k) => (
                            <ChipLink key={k} href={showHref(k)} on={filters.show === k} className={chip(filters.show === k)}>
                                {t(k === 'all' ? 'mandal.printEveryone' : k === 'present' ? 'mandal.onlyPresent' : 'mandal.onlyAbsent')}
                            </ChipLink>
                        ))}
                    </div>
                    <div className="overflow-x-auto">
                        <MandalScheduleSheets shown={shownSheets} show={filters.show} t={t} locale={locale} />
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm sm:p-6">
                <Statement
                    campaign={shownCampaign}
                    contributors={contributors}
                    contributions={contributions}
                    expenses={expenses}
                    t={t}
                    locale={locale}
                    publicView
                    // A Mandal's payments are in the schedule lists above: here its totals and expenses.
                    sections={isMandal ? ['expenses'] : undefined}
                />
            </div>
            <p className="text-center text-xs text-ink-gray">{t('fundraise.poweredBy')}</p>
        </main>
    );
}
