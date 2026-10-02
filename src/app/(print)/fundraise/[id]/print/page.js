import { notFound } from 'next/navigation';
import LedgerSheet from '@/components/fundraise/ledger-sheet';
import PrintSheet from '@/components/fundraise/print-sheet';
import { statementSections } from '@/components/fundraise/statement';
import { canManageFundraise } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { canSeeCampaign, contributorTotals, getCampaign, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { sp1 } from '@/lib/url';

// Lives in its own (print) route group — same URL as /fundraise/[id]/print, but
// without the app shell, whose fixed-height frame would clip the printout.

export async function generateMetadata({ params }) {
    const { id } = await params;
    const { t, locale } = await getT();
    const c = await getCampaign(Number(id));
    return { title: c ? `${localized(c, 'title', locale)} · ${t('fundraise.statement')}` : undefined };
}

export default async function FundraisePrintPage({ params, searchParams }) {
    const { id } = await params;
    const sp = await searchParams;
    const user = await requireUser();
    const campaign = await getCampaign(Number(id));
    if (!campaign) notFound();
    if (campaign.status === 'draft' && !(await canManageFundraise(user, campaign))) notFound();
    if (!(await canSeeCampaign(user, campaign.id))) notFound();

    const { t, locale } = await getT();

    // ?format=list — the simple "amount  name / ----- / Total" statement (same as Copy).
    if (sp1(sp.format) === 'list') {
        const kind = ['income', 'expense', 'both'].includes(sp1(sp.kind)) ? sp1(sp.kind) : 'both';
        const [income, expense] = await Promise.all([
            kind === 'expense' ? [] : listContributions(campaign.id),
            kind === 'income' ? [] : listExpenses(campaign.id),
        ]);
        return (
            <LedgerSheet campaign={campaign} income={income} expense={expense} kind={kind} t={t} locale={locale} backHref={`/fundraise/${campaign.id}?tab=money`} />
        );
    }

    const manage = await canManageFundraise(user, campaign);
    const [contributors, contributions, expenses] = await Promise.all([
        contributorTotals(campaign.id, { publicView: !manage }),
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
            basePath={`/fundraise/${campaign.id}/print`}
            sections={statementSections(sp1(sp.show))}
            // Anonymous gifts show the donor's name to managers only.
            publicView={!manage}
        />
    );
}
