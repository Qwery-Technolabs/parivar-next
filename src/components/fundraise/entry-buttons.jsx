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
const MandalContributionDialog = dynamic(() => import('@/components/mandal/mandal-contribution-dialog'), { ssr: false, loading: Placeholder });

/** Phones: a round "+" in the entry's colour (blue contribution, orange expense). */
function PlusTrigger({ label, tone }) {
    return function Trigger({ open }) {
        return (
            <button
                type="button"
                onClick={open}
                aria-label={label}
                title={label}
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                    tone === 'expense' ? 'bg-expense hover:bg-expense-hover' : 'bg-income hover:bg-income-hover'
                }`}
            >
                <Plus className="size-5" />
            </button>
        );
    };
}

/**
 * Each button only for the matching permission: a collector records contributions, not expenses.
 * From sm up: both labelled buttons. Phones: two round "+" buttons — blue adds a contribution,
 * orange an expense (the same colours as the amounts and the tabs).
 */
/**
 * `scheduling` (a Mandal): { schedules, defaultSchedule } — the expense dialog asks which schedule.
 * `mandalAdd` (a Mandal): { members, schedules, defaultSchedule } — "+ Contribution" is the short Mandal
 * form (member, schedule, came, amount, mode) instead of the fundraise one.
 */
export default function EntryButtons({
    campaignId,
    today,
    perms,
    allowAnonymous,
    categories,
    people = [],
    meId = null,
    handDefault = false,
    scheduling = {},
    mandalAdd = null,
}) {
    const { t } = useT();
    const addContribution = (trigger) =>
        mandalAdd ? (
            <MandalContributionDialog campaignId={campaignId} {...mandalAdd} trigger={trigger} />
        ) : (
            <ContributionDialog
                campaignId={campaignId}
                today={today}
                allowAnonymous={allowAnonymous}
                people={people}
                meId={meId}
                {...scheduling}
                handDefault={handDefault}
                trigger={trigger}
            />
        );
    return (
        <>
            <span className="hidden sm:contents">
                {perms.contribution && addContribution(undefined)}
                {perms.expense && <ExpenseDialog campaignId={campaignId} today={today} categories={categories} people={people} meId={meId} {...scheduling} />}
            </span>
            <span className="contents sm:hidden">
                {perms.contribution && addContribution(PlusTrigger({ label: t('fundraise.addContribution'), tone: 'income' }))}
                {perms.expense && (
                    <ExpenseDialog
                        campaignId={campaignId}
                        today={today}
                        categories={categories}
                        people={people}
                        meId={meId}
                        {...scheduling}
                        trigger={PlusTrigger({ label: t('fundraise.addExpense'), tone: 'expense' })}
                    />
                )}
            </span>
        </>
    );
}
