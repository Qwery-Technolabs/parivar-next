import { NextResponse } from 'next/server';
import { canManageFundraise } from '@/lib/access';
import { getCurrentUser } from '@/lib/auth';
import { getCampaign, listContributions, listExpenses } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { ledgerText } from '@/lib/ledger-text';

const KINDS = ['income', 'expense', 'both'];

/** Plain-text statement for the Copy button: ?kind=income|expense|both. Same visibility as the fundraise page. */
export async function GET(request, { params }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { id } = await params;
    const campaign = await getCampaign(Number(id) || 0);
    if (!campaign || (campaign.status === 'draft' && !(await canManageFundraise(user, campaign)))) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const kind = KINDS.includes(request.nextUrl.searchParams.get('kind')) ? request.nextUrl.searchParams.get('kind') : 'both';
    const { t, locale } = await getT();
    const [income, expense] = await Promise.all([
        kind === 'expense' ? [] : listContributions(campaign.id),
        kind === 'income' ? [] : listExpenses(campaign.id),
    ]);
    const text = ledgerText({ income, expense, kind, title: `*${localized(campaign, 'title', locale)}*` }, t);
    return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
