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
import { mandalLedger, mandalStatement } from '@/lib/mandal';
import { mandalFilters } from '@/lib/mandal-filters';

// A leaked link must not be indexed; the committee can kill it with "New link".
export async function generateMetadata({ params }) {
    const { token } = await params;
    const { locale } = await getT();
    const c = await getCampaignByToken(token);
    return { title: c ? localized(c, 'title', locale) : undefined, robots: { index: false, follow: false } };
}

export default async function PublicFundraisePage({ params, searchParams }) {
    const { token } = await params;
    const campaign = await getCampaignByToken(token);
    if (!campaign) notFound();

    const { t, locale } = await getT();
    // A Mandal: its income and expenses by date — all, one schedule, or a date range.
    const isMandal = campaign.kind === 'mandal';
    const filters = isMandal ? mandalFilters(await searchParams) : null;
    const [plain, ledger] = await Promise.all([
        isMandal ? null : Promise.all([contributorTotals(campaign.id, { publicView: true }), listContributions(campaign.id), listExpenses(campaign.id)]),
        isMandal ? mandalLedger(campaign.id, filters) : null,
    ]);
    // A Mandal: the same three tables, from the filtered rows (totals follow the filter).
    const { contributors, contributions, expenses, shownCampaign } = isMandal
        ? mandalStatement(campaign, ledger)
        : { contributors: plain[0], contributions: plain[1], expenses: plain[2], shownCampaign: campaign };
    const query = filters?.query ? `?${filters.query}` : '';
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
                    {isMandal && (
                        <MandalFilterButton
                            basePath={`/p/${token}`}
                            filters={filters}
                            schedules={ledger.schedules.map((s) => ({ id: s.id, label: `${date(s.start_date, locale)} - ${t('mandal.word')}` }))}
                        />
                    )}
                    {/* Icon only; the label stays as tooltip and screen-reader name. */}
                    <Link
                        href={`/p/${token}/print${query}`}
                        aria-label={t('common.downloadPdf')}
                        title={t('common.downloadPdf')}
                        className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 sm:ml-0"
                    >
                        <FileDown className="size-4" />
                    </Link>
                </div>
            </div>

            <FundraiseSummary campaign={campaign} t={t} />

            <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm sm:p-6">
                <Statement
                    campaign={shownCampaign}
                    contributors={contributors}
                    contributions={contributions}
                    expenses={expenses}
                    t={t}
                    locale={locale}
                    publicView
                />
            </div>
            <p className="text-center text-xs text-ink-gray">{t('fundraise.poweredBy')}</p>
        </main>
    );
}
