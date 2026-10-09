import { date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';

// Payment mode: its own colour per mode; "Not paid" (pending pledge / Mandal due) in red, amount too.
const MODE_TONE = {
    cash: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    upi: 'bg-violet-50 text-violet-800 ring-violet-200',
    bank: 'bg-sky-50 text-sky-800 ring-sky-200',
    cheque: 'bg-amber-50 text-amber-800 ring-amber-200',
    other: 'bg-slate-100 text-slate-700 ring-slate-200',
    unpaid: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/** The statement's tables, in order; the print pages let the reader pick which to include. */
export const STATEMENT_SECTIONS = ['contributors', 'contributions', 'expenses'];

/** `?show=contributors,expenses` → the chosen sections (default: contributions only). */
export function statementSections(raw) {
    const picked = String(raw ?? '')
        .split(',')
        .filter((s) => STATEMENT_SECTIONS.includes(s));
    return picked.length ? STATEMENT_SECTIONS.filter((s) => picked.includes(s)) : ['contributions'];
}

/**
 * The full statement: totals, contributors, contributions, expenses. Used by the
 * public page and both print pages. `publicView` hides names of anonymous gifts
 * and every internal field (references, recorded-by, ids).
 */
export default function Statement({ campaign, contributors, contributions, expenses, t, locale, publicView = false, sections = STATEMENT_SECTIONS }) {
    const collected = Number(campaign.collected);
    const spent = Number(campaign.spent);
    // A member's name in the page language (local script on a Gujarati page); anonymous stays hidden.
    const name = (row) => (publicView && row.is_anonymous ? t('fundraise.anonymousLabel') : (locale !== 'en' && row.donor_name_local) || row.donor_name);
    const description = localized(campaign.meta ?? {}, 'description', locale);
    // "By contributor" lists only people who have paid something (pending-only = ₹0 is left out),
    // counting their paid entries; the Contributions table still lists every entry, pending too.
    const givers = contributors.filter((c) => Number(c.total) > 0);
    const paidEntries = (c) => Number(c.paid_entries ?? c.entries);

    return (
        <div className="space-y-6 print:space-y-4">
            {description && <p className="whitespace-pre-line text-sm text-ink break-words">{description}</p>}

            {sections.includes('contributors') && (
                <Section title={t('fundraise.byContributor')} note={t('fundraise.contributorCount', { count: givers.length })}>
                    <Table
                        head={[t('fundraise.donor'), t('fundraise.entries'), t('fundraise.amount')]}
                        numeric={[false, true, true]}
                        empty={t('fundraise.noContributions')}
                        rows={givers.map((c) => [name(c), paidEntries(c), money(c.total)])}
                        foot={[t('common.total'), givers.reduce((s, c) => s + paidEntries(c), 0), money(collected)]}
                        footTone="text-income"
                    />
                </Section>
            )}

            {sections.includes('contributions') && (
                <Section title={t('fundraise.contributions')} note={t('fundraise.count', { count: contributions.length })}>
                    <Table
                        head={[t('common.date'), t('fundraise.donor'), t('fundraise.mode'), t('fundraise.amount')]}
                        numeric={[false, false, false, true]}
                        empty={t('fundraise.noContributions')}
                        rows={contributions.map((c) => [
                            date(c.paid_on, locale),
                            name(c),
                            <span
                                key="m"
                                className={`inline-block rounded-full px-2 py-px text-xs font-medium ring-1 ring-inset ${MODE_TONE[c.mode] ?? MODE_TONE.other}`}
                            >
                                {/* Short on the statement: "Pending" / "બાકી" (the form keeps "Not paid (pending)"). */}
                                {c.mode === 'unpaid' ? t('fundraise.pendingBadge') : t(`fundraise.modes.${c.mode}`)}
                            </span>,
                            <span key="a" className={c.mode === 'unpaid' ? 'font-semibold text-rose-700' : ''}>
                                {money(c.amount)}
                            </span>,
                        ])}
                        foot={[t('common.total'), '', '', money(collected)]}
                        footTone="text-income"
                    />
                </Section>
            )}

            {sections.includes('expenses') && (
                <Section title={t('fundraise.expenses')} note={t('fundraise.count', { count: expenses.length })}>
                    <Table
                        head={[t('common.date'), t('fundraise.expenseWhat'), t('fundraise.expenseWhere'), t('fundraise.amount')]}
                        numeric={[false, false, false, true]}
                        empty={t('fundraise.noExpenses')}
                        rows={expenses.map((e) => [date(e.spent_on, locale), e.title, e.place || '—', money(e.amount)])}
                        foot={[t('common.total'), '', '', money(spent)]}
                        footTone="text-expense"
                    />
                </Section>
            )}

            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-surface-border pt-3 text-sm">
                <span className="text-ink-gray">
                    {t('fundraise.collected')}: <b className="tabular-nums text-income">{money(collected)}</b>
                </span>
                {Number(campaign.pending) > 0 && (
                    <span className="text-ink-gray">
                        {t('fundraise.pendingTotal')}: <b className="tabular-nums text-rose-700">{money(campaign.pending)}</b>
                    </span>
                )}
                <span className="text-ink-gray">
                    {t('fundraise.spent')}: <b className="tabular-nums text-expense">{money(spent)}</b>
                </span>
                <span className="text-ink-gray">
                    {t('fundraise.balance')}:{' '}
                    <b className={`tabular-nums ${collected - spent < 0 ? 'text-rose-700' : 'text-primary'}`}>{money(collected - spent)}</b>
                </span>
            </div>
        </div>
    );
}

function Section({ title, note, children }) {
    return (
        <section className="break-inside-avoid-page">
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">{title}</h2>
                <span className="text-xs text-ink-gray">{note}</span>
            </div>
            {children}
        </section>
    );
}

function Table({ head, rows, foot, numeric, empty, footTone }) {
    const align = (i) => (numeric[i] ? 'text-right tabular-nums' : 'break-words');
    return (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-white print:rounded-none">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-border bg-surface-login text-left text-xs uppercase tracking-wide text-ink-gray">
                            {head.map((h, i) => (
                                <th key={i} className={`px-4 py-2.5 font-semibold ${numeric[i] ? 'text-right' : ''}`}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={head.length} className="px-4 py-6 text-center text-ink-gray">
                                    {empty}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r, ri) => (
                                <tr key={ri} className="border-b border-surface-border last:border-0 break-inside-avoid">
                                    {r.map((cell, i) => (
                                        <td key={i} className={`px-4 py-2 ${align(i)}`}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                    {rows.length > 0 && (
                        <tfoot>
                            <tr className="border-t border-surface-border bg-surface-login font-semibold">
                                {foot.map((cell, i) => (
                                    <td key={i} className={`px-4 py-2 ${align(i)} ${i === foot.length - 1 ? footTone : 'text-primary'}`}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
