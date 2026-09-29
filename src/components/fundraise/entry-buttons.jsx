'use client';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useT } from '@/lib/i18n/client';

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

/** Phones: a single round "+" (the add action for the list on screen). */
function PlusTrigger({ label }) {
    return function Trigger({ open }) {
        return (
            <button
                type="button"
                onClick={open}
                aria-label={label}
                title={label}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
                <Plus className="size-5" />
            </button>
        );
    };
}

/**
 * Each button only for the matching permission: a collector records contributions, not expenses.
 * From sm up: both labelled buttons. Phones: ONE "+" that adds what the list shows — an expense on
 * the Expenses view, a contribution otherwise (falling back to whichever the person may add).
 */
export default function EntryButtons({ campaignId, today, perms, allowAnonymous, categories, view }) {
    const { t } = useT();
    const phoneKind = view === 'expenses' ? (perms.expense ? 'expense' : 'contribution') : perms.contribution ? 'contribution' : 'expense';
    return (
        <>
            <span className="hidden sm:contents">
                {perms.contribution && <ContributionDialog campaignId={campaignId} today={today} allowAnonymous={allowAnonymous} />}
                {perms.expense && <ExpenseDialog campaignId={campaignId} today={today} categories={categories} />}
            </span>
            <span className="contents sm:hidden">
                {phoneKind === 'contribution' && perms.contribution && (
                    <ContributionDialog
                        campaignId={campaignId}
                        today={today}
                        allowAnonymous={allowAnonymous}
                        trigger={PlusTrigger({ label: t('fundraise.addContribution') })}
                    />
                )}
                {phoneKind === 'expense' && perms.expense && (
                    <ExpenseDialog campaignId={campaignId} today={today} categories={categories} trigger={PlusTrigger({ label: t('fundraise.addExpense') })} />
                )}
            </span>
        </>
    );
}
