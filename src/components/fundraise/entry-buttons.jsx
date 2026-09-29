'use client';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';

// The two dialogs pull in Base UI's Dialog, the member Combobox and their forms — only
// managers ever see them, so they load as separate chunks instead of riding every view.
function Placeholder() {
    return (
        <span className="inline-flex h-9 w-40 shrink-0 cursor-wait items-center justify-center gap-2 rounded-md border border-surface-border bg-white text-sm text-ink-gray opacity-70">
            <Plus className="size-4" />
        </span>
    );
}

const ContributionDialog = dynamic(() => import('./contribution-dialog'), { ssr: false, loading: Placeholder });
const ExpenseDialog = dynamic(() => import('./expense-dialog'), { ssr: false, loading: Placeholder });

/** Each button only for the matching permission: a collector records contributions, not expenses. */
export default function EntryButtons({ campaignId, today, perms, allowAnonymous, categories }) {
    return (
        <>
            {perms.contribution && <ContributionDialog campaignId={campaignId} today={today} allowAnonymous={allowAnonymous} />}
            {perms.expense && <ExpenseDialog campaignId={campaignId} today={today} categories={categories} />}
        </>
    );
}
