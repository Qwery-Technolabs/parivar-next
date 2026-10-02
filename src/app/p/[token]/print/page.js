import { notFound } from 'next/navigation';
import PrintSheet from '@/components/fundraise/print-sheet';
import { statementSections } from '@/components/fundraise/statement';
import { contributorTotals, getCampaignByToken, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
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
    const sections = statementSections(sp1((await searchParams).show));
    const campaign = await getCampaignByToken(token);
    if (!campaign) notFound();

    const { t, locale } = await getT();
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
