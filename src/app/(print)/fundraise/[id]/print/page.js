import { notFound } from 'next/navigation';
import LedgerSheet from '@/components/fundraise/ledger-sheet';
import MandalPrint from '@/components/mandal/mandal-print';
import PrintSheet from '@/components/fundraise/print-sheet';
import { statementSections } from '@/components/fundraise/statement';
import { canManageFundraise } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { canSeeCampaign, contributorTotals, getCampaign, listContributions, listExpenses } from '@/lib/fundraise';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { mandalLedger, mandalSheets, mandalStatement } from '@/lib/mandal';
import { mandalFilters } from '@/lib/mandal-filters';
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
    // Every lookup that can run at once does (each wait is a round trip to the remote database): who
    // asks + the fundraise + texts, then the checks together with the rows to print.
    const [{ id }, sp] = await Promise.all([params, searchParams]);
    const [user, campaign, { t, locale }] = await Promise.all([requireUser(), getCampaign(Number(id)), getT()]);
    if (!campaign) notFound();
    const manageP = canManageFundraise(user, campaign);
    const checks = Promise.all([manageP, canSeeCampaign(user, campaign.id)]);
    const allowed = async () => {
        const [manage, visible] = await checks;
        if ((campaign.status === 'draft' && !manage) || !visible) notFound();
        return manage;
    };

    // A Mandal prints its schedules — all of them, or one (?schedule=<id>) — never the fundraise statement.
    if (campaign.kind === 'mandal') {
        // By contributors (default) · By schedules · Expenses, over all schedules (default) or the chosen ones.
        const filters = mandalFilters(sp, 'app');
        const today = todayLocal();
        const [manage, ledger, sheets] = await Promise.all([allowed(), mandalLedger(campaign.id, filters, today), mandalSheets(campaign, today)]);
        return (
            <MandalPrint
                campaign={campaign}
                filters={filters}
                selected={ledger.ids}
                sheets={sheets}
                statement={mandalStatement(campaign, ledger)}
                t={t}
                locale={locale}
                backHref={`/mandal/${campaign.id}?tab=money`}
                basePath={`/fundraise/${campaign.id}/print`}
                // Anonymous gifts show the donor's name to managers only.
                publicView={!manage}
            />
        );
    }

    // ?format=list — the simple "amount  name / ----- / Total" statement (same as Copy).
    if (sp1(sp.format) === 'list') {
        const kind = ['income', 'expense', 'both'].includes(sp1(sp.kind)) ? sp1(sp.kind) : 'both';
        const [, income, expense] = await Promise.all([
            allowed(),
            kind === 'expense' ? [] : listContributions(campaign.id),
            kind === 'income' ? [] : listExpenses(campaign.id),
        ]);
        return (
            <LedgerSheet
                campaign={campaign}
                income={income}
                expense={expense}
                kind={kind}
                t={t}
                locale={locale}
                backHref={`/fundraise/${campaign.id}?tab=money`}
            />
        );
    }

    const [manage, contributors, contributions, expenses] = await Promise.all([
        allowed(),
        manageP.then((m) => contributorTotals(campaign.id, { publicView: !m })),
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
