import { date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';

/**
 * The full statement: totals, contributors, contributions, expenses. Used by the
 * public page and both print pages. `publicView` hides names of anonymous gifts
 * and every internal field (references, recorded-by, ids).
 */
export default function Statement({ campaign, contributors, contributions, expenses, t, locale, publicView = false }) {
    const collected = Number(campaign.collected);
    const spent = Number(campaign.spent);
    const name = (row) => (publicView && row.is_anonymous ? t('fundraise.anonymousLabel') : row.donor_name);
    const description = localized(campaign.meta ?? {}, 'description', locale);

    return (
        <div className="space-y-6 print:space-y-4">
            {description && <p className="whitespace-pre-line text-sm text-ink break-words">{description}</p>}

            <Section title={t('fundraise.byContributor')} note={t('fundraise.contributorCount', { count: contributors.length })}>
                <Table
                    head={[t('fundraise.donor'), t('fundraise.entries'), t('fundraise.amount')]}
                    numeric={[false, true, true]}
                    empty={t('fundraise.noContributions')}
                    rows={contributors.map((c) => [name(c), c.entries, money(c.total)])}
                    foot={[t('common.total'), contributions.length, money(collected)]}
                    footTone="text-emerald-700"
                />
            </Section>

            <Section title={t('fundraise.contributions')} note={t('fundraise.count', { count: contributions.length })}>
                <Table
                    head={[t('common.date'), t('fundraise.donor'), t('fundraise.mode'), t('fundraise.amount')]}
                    numeric={[false, false, false, true]}
                    empty={t('fundraise.noContributions')}
                    rows={contributions.map((c) => [
                        date(c.paid_on, locale),
                        name(c),
                        t(`fundraise.modes.${c.mode}`),
                        money(c.amount),
                    ])}
                    foot={[t('common.total'), '', '', money(collected)]}
                    footTone="text-emerald-700"
                />
            </Section>

            <Section title={t('fundraise.expenses')} note={t('fundraise.count', { count: expenses.length })}>
                <Table
                    head={[t('common.date'), t('fundraise.expenseWhat'), t('fundraise.expenseWhere'), t('fundraise.amount')]}
                    numeric={[false, false, false, true]}
                    empty={t('fundraise.noExpenses')}
                    rows={expenses.map((e) => [date(e.spent_on, locale), e.title, e.place || '—', money(e.amount)])}
                    foot={[t('common.total'), '', '', money(spent)]}
                    footTone="text-rose-700"
                />
            </Section>

            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-surface-border pt-3 text-sm">
                <span className="text-ink-gray">
                    {t('fundraise.collected')}: <b className="tabular-nums text-emerald-700">{money(collected)}</b>
                </span>
                <span className="text-ink-gray">
                    {t('fundraise.spent')}: <b className="tabular-nums text-rose-700">{money(spent)}</b>
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
