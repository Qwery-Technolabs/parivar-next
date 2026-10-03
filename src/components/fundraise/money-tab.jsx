import Link from 'next/link';
import Badge from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { date, money } from '@/lib/format';
import { buildHref } from '@/lib/url';
import EntryButtons from './entry-buttons';
import RowActions from './row-actions';
import FundraiseSummary from './summary';
import LedgerExport from './ledger-export';

export const MONEY_VIEWS = ['contributions', 'expenses', 'contributors'];

/**
 * Income / Expense tab (server component): totals + progress, a segmented switch between
 * contributions / expenses / by-contributor (?view=, default = contributions = absence),
 * the add buttons the viewer's permissions allow, and the table.
 */
export default function MoneyTab({ campaign, view, rows, total, page, perPage, perms, settings, today, base, sp, t, locale, people = [], meId = null }) {
    // Every viewer gets the row menu (History); Edit / Delete for whoever may record that kind
    // (contributions: managers, treasurers, collectors; expenses: managers, expensers) — every change is in the History.
    const rowProps = {
        today,
        allowAnonymous: settings.allow_anonymous,
        categories: settings.expense_categories,
        people,
        meId,
    };
    const labels = {
        contributions: t('fundraise.contributions'),
        expenses: t('fundraise.expenses'),
        contributors: t('fundraise.byContributor'),
    };
    const counts = { contributions: campaign.contribution_count, expenses: campaign.expense_count };
    const ledgerKind = view === 'contributions' ? 'income' : view === 'expenses' ? 'expense' : 'both';

    return (
        <div className="space-y-4">
            <FundraiseSummary campaign={campaign} t={t} compact />

            {/* Phones: one row — the view switch (scrolls if the words are long), Share, and a single "+".
                From sm up: the switch, then both labelled add buttons; the share buttons below. */}
            <div className="flex items-center gap-2 sm:flex-wrap sm:justify-between sm:gap-3">
                <div className="inline-flex min-w-0 flex-1 overflow-x-auto rounded-md bg-surface-bggray/70 p-0.5 sm:flex-none sm:flex-wrap">
                    {MONEY_VIEWS.map((k) => (
                        <Link
                            key={k}
                            href={buildHref(base, sp, { tab: 'money', view: k === 'contributions' ? null : k, page: null })}
                            scroll={false}
                            aria-current={view === k ? 'true' : undefined}
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium ${
                                // Contributions / By contributor = blue, Expenses = orange (the ledger colours).
                                view === k
                                    ? `${k === 'expenses' ? 'bg-expense' : 'bg-income'} text-white shadow-sm`
                                    : `text-ink-gray ${k === 'expenses' ? 'hover:text-expense' : 'hover:text-income'}`
                            }`}
                        >
                            {labels[k]}
                            {counts[k] != null && <span className="tabular-nums opacity-80">{counts[k]}</span>}
                        </Link>
                    ))}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="contents sm:hidden">
                        <LedgerExport campaignId={campaign.id} kind={ledgerKind} menu />
                    </span>
                    {(perms.contribution || perms.expense) && (
                        <EntryButtons
                            campaignId={campaign.id}
                            today={today}
                            perms={{ contribution: perms.contribution, expense: perms.expense }}
                            allowAnonymous={settings.allow_anonymous}
                            categories={settings.expense_categories}
                            people={people}
                            meId={meId}
                        />
                    )}
                </div>
            </div>

            {/* Share the list: WhatsApp-ready text or a printable PDF — for every viewer (phones: the Share menu above). */}
            <div className="hidden sm:block">
                <LedgerExport campaignId={campaign.id} kind={ledgerKind} />
            </div>

            {!perms.contribution && !perms.expense && <p className="text-xs text-ink-gray">{t('fundraise.viewOnly')}</p>}

            {view === 'contributions' && (
                <TableShell>
                    <THead>
                        <Th>{t('fundraise.paidOn')}</Th>
                        <Th>{t('fundraise.donor')}</Th>
                        <Th className="hidden sm:table-cell">{t('fundraise.mode')}</Th>
                        <Th numeric>{t('fundraise.amount')}</Th>
                        <Th className="w-12" />
                    </THead>
                    <tbody>
                        {rows.length === 0 ? (
                            <EmptyRow colSpan={5}>{t('fundraise.noContributions')}</EmptyRow>
                        ) : (
                            rows.map((c) => (
                                <Tr key={c.id}>
                                    <Td className="whitespace-nowrap text-ink-gray">{date(c.paid_on, locale)}</Td>
                                    <Td>
                                        <DonorName row={c} />
                                        {c.is_anonymous && perms.manage ? (
                                            <Badge tone="gray" className="ml-2">
                                                {t('fundraise.anonymousLabel')}
                                            </Badge>
                                        ) : null}
                                        {c.reference && <span className="block text-xs text-ink-gray">{c.reference}</span>}
                                    </Td>
                                    <Td className="hidden sm:table-cell">
                                        {c.mode === 'unpaid' ? <Badge tone="amber">{t('fundraise.pendingBadge')}</Badge> : t(`fundraise.modes.${c.mode}`)}
                                    </Td>
                                    <Td numeric className={`font-medium ${c.mode === 'unpaid' ? 'text-amber-800' : 'text-income'}`}>
                                        {money(c.amount)}
                                    </Td>
                                    <Td className="w-12 py-1">
                                        <RowActions kind="contribution" campaignId={campaign.id} row={c} canManage={perms.contribution} {...rowProps} />
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </tbody>
                </TableShell>
            )}

            {view === 'expenses' && (
                <TableShell>
                    <THead>
                        <Th>{t('fundraise.spentOn')}</Th>
                        <Th>{t('fundraise.expenseWhat')}</Th>
                        <Th className="hidden md:table-cell">{t('fundraise.expenseWhere')}</Th>
                        <Th numeric>{t('fundraise.amount')}</Th>
                        <Th className="w-12" />
                    </THead>
                    <tbody>
                        {rows.length === 0 ? (
                            <EmptyRow colSpan={5}>{t('fundraise.noExpenses')}</EmptyRow>
                        ) : (
                            rows.map((e) => (
                                <Tr key={e.id}>
                                    <Td className="whitespace-nowrap text-ink-gray">{date(e.spent_on, locale)}</Td>
                                    <Td>
                                        <span className="font-medium text-primary">{e.title}</span>
                                        {e.category && (
                                            <Badge tone="navy" className="ml-2">
                                                {e.category}
                                            </Badge>
                                        )}
                                        {e.place && <span className="block text-xs text-ink-gray md:hidden">{e.place}</span>}
                                        {e.paid_by_name && (
                                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-gray">
                                                {t('fundraise.paidByName', { name: (locale !== 'en' && e.paid_by_name_local) || e.paid_by_name })}
                                                <Badge tone={e.repaid ? 'green' : 'amber'}>{e.repaid ? t('fundraise.repaidBadge') : t('fundraise.toRepayBadge')}</Badge>
                                            </span>
                                        )}
                                        {(e.bill_ref || e.notes) && (
                                            <span className="block whitespace-pre-line text-xs text-ink-gray">
                                                {[e.bill_ref && `${t('fundraise.billRef')}: ${e.bill_ref}`, e.notes].filter(Boolean).join(' · ')}
                                            </span>
                                        )}
                                    </Td>
                                    <Td className="hidden md:table-cell">{e.place || null}</Td>
                                    <Td numeric className="font-medium text-expense">
                                        {money(e.amount)}
                                    </Td>
                                    <Td className="w-12 py-1">
                                        <RowActions kind="expense" campaignId={campaign.id} row={e} canManage={perms.expense} {...rowProps} />
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </tbody>
                </TableShell>
            )}

            {view === 'contributors' && (
                <TableShell>
                    <THead>
                        <Th>{t('fundraise.donor')}</Th>
                        <Th numeric>{t('fundraise.entries')}</Th>
                        <Th className="hidden sm:table-cell">{t('fundraise.lastPaid')}</Th>
                        <Th numeric>{t('common.total')}</Th>
                    </THead>
                    <tbody>
                        {rows.length === 0 ? (
                            <EmptyRow colSpan={4}>{t('fundraise.noContributions')}</EmptyRow>
                        ) : (
                            rows.map((c) => (
                                <Tr key={c.k}>
                                    <Td>
                                        <DonorName row={c} />
                                    </Td>
                                    <Td numeric>{c.entries}</Td>
                                    <Td className="hidden whitespace-nowrap text-ink-gray sm:table-cell">{date(c.last_paid, locale)}</Td>
                                    <Td numeric className="font-semibold text-income">
                                        {money(c.total)}
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </tbody>
                </TableShell>
            )}

            {view !== 'contributors' && <Pagination pathname={base} searchParams={sp} page={page} perPage={perPage} total={total} t={t} />}
        </div>
    );
}

function DonorName({ row }) {
    return row.user_id ? (
        <Link href={`/members/${row.user_id}`} className="font-medium text-primary hover:underline">
            {row.donor_name}
        </Link>
    ) : (
        <span className="font-medium text-primary">{row.donor_name}</span>
    );
}
