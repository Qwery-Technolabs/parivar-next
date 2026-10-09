import { notFound } from 'next/navigation';
import PrintSheet from '@/components/fundraise/print-sheet';
import { statementSections } from '@/components/fundraise/statement';
import { contributorTotals, getCampaignByToken, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import MandalPrint from '@/components/mandal/mandal-print';
import { todayLocal } from '@/lib/forms';
import { mandalLedger, mandalSheets, mandalStatement } from '@/lib/mandal';
import { mandalPrintFilters, mandalQuery } from '@/lib/mandal-filters';
import { sp1 } from '@/lib/url';

export async function generateMetadata({ params }) {
    const { token } = await params;
    const { t, locale } = await getT();
    const c = await getCampaignByToken(token);
    return {
        title: c ? `${localized(c, 'title', locale)} · ${t('fundraise.statement')}` : undefined,
        robots: { index: false, follow: false },
    };
}

export default async function PublicFundraisePrintPage({ params, searchParams }) {
    const { token } = await params;
    const sp = await searchParams;
    const sections = statementSections(sp1(sp.show));
    // The campaign and the texts load together.
    const [campaign, { t, locale }] = await Promise.all([getCampaignByToken(token), getT()]);
    if (!campaign) notFound();

    // A Mandal prints its schedules like the app's Mandal PDF: all or one (chips), Everyone / Came only /
    // Absent only — within the public link's date range, if one is set (kept on every chip).
    if (campaign.kind === 'mandal') {
        // Default: By contributors of the latest schedule — a light page; every chip opens the rest.
        const filters = mandalPrintFilters(sp, 'public');
        const today = todayLocal();
        const [ledger, sheets] = await Promise.all([mandalLedger(campaign.id, filters, today), mandalSheets(campaign, today)]);
        const back = mandalQuery(filters, { ids: ledger.ids, all: !ledger.ids.length, view: undefined });
        return (
            <MandalPrint
                campaign={campaign}
                filters={filters}
                selected={ledger.ids}
                sheets={sheets}
                statement={mandalStatement(campaign, ledger)}
                t={t}
                locale={locale}
                backHref={`/p/${token}${back ? `?${back}` : ''}`}
                basePath={`/p/${token}/print`}
                publicView
            />
        );
    }
    const [contributors, contributions, expenses] = await Promise.all([
        contributorTotals(campaign.id, { publicView: true }),
        listContributions(campaign.id),
        listExpenses(campaign.id),
    ]);

    return (
        <PrintSheet
            campaign={campaign}
            contributors={contributors}
            contributions={contributions}
            expenses={expenses}
            t={t}
            locale={locale}
            backHref={`/p/${token}`}
            basePath={`/p/${token}/print`}
            sections={sections}
            publicView
        />
    );
}
