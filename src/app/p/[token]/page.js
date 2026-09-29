import { Printer } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FundraiseSummary from '@/components/fundraise/summary';
import Statement from '@/components/fundraise/statement';
import Badge from '@/components/ui/badge';
import { date } from '@/lib/format';
import { contributorTotals, getCampaignByToken, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';

// A leaked link must not be indexed; the committee can kill it with "New link".
export async function generateMetadata({ params }) {
    const { token } = await params;
    const { locale } = await getT();
    const c = await getCampaignByToken(token);
    return { title: c ? localized(c, 'title', locale) : undefined, robots: { index: false, follow: false } };
}

export default async function PublicFundraisePage({ params }) {
    const { token } = await params;
    const campaign = await getCampaignByToken(token);
    if (!campaign) notFound();

    const { t, locale } = await getT();
    const [contributors, contributions, expenses] = await Promise.all([
        contributorTotals(campaign.id, { publicView: true }),
        listContributions(campaign.id),
        listExpenses(campaign.id),
    ]);
    const groupName = campaign.group_id ? localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale) : '';
    const dates = campaign.start_date || campaign.end_date ? `${date(campaign.start_date, locale)} – ${date(campaign.end_date, locale)}` : '';

    return (
        <main className="theme-fundraise mx-auto max-w-4xl space-y-5 px-4 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.publicTitle')}</p>
                    <h1 className="mt-1 text-lg font-semibold text-primary break-words">{localized(campaign, 'title', locale)}</h1>
                    {(groupName || dates || campaign.location) && (
                        <p className="mt-0.5 text-xs text-ink-gray">{[groupName, campaign.location, dates].filter(Boolean).join(' · ')}</p>
                    )}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Badge status={campaign.status}>{t(`fundraise.${campaign.status}`)}</Badge>
                    <Link
                        href={`/p/${token}/print`}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:flex-none"
                    >
                        <Printer className="size-4" /> {t('common.downloadPdf')}
                    </Link>
                </div>
            </div>

            <FundraiseSummary campaign={campaign} t={t} />

            <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm sm:p-6">
                <Statement
                    campaign={campaign}
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
