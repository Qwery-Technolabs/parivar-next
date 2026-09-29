import { notFound } from 'next/navigation';
import PrintSheet from '@/components/fundraise/print-sheet';
import { canManageFundraise } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { contributorTotals, getCampaign, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';

// Lives in its own (print) route group — same URL as /fundraise/[id]/print, but
// without the app shell, whose fixed-height frame would clip the printout.

export async function generateMetadata({ params }) {
    const { id } = await params;
    const { t, locale } = await getT();
    const c = await getCampaign(Number(id));
    return { title: c ? `${localized(c, 'title', locale)} · ${t('fundraise.statement')}` : undefined };
}

export default async function FundraisePrintPage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const campaign = await getCampaign(Number(id));
    if (!campaign) notFound();
    if (campaign.status === 'draft' && !(await canManageFundraise(user, campaign))) notFound();

    const { t, locale } = await getT();
    const [contributors, contributions, expenses] = await Promise.all([
        contributorTotals(campaign.id),
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
            backHref={`/fundraise/${campaign.id}`}
            publicView={false}
        />
    );
}
