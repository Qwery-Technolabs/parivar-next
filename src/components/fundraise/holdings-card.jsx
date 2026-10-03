import { HandCoins } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/shell/page-header';
import { money } from '@/lib/format';

/**
 * Holdings (About tab, under Team; everyone who can see the fundraise): who has money outside the
 * treasurer — "Holds ₹…" = contributions they keep, not handed over; "To get back ₹…" = expenses
 * they paid themselves, not repaid yet. From listHoldings(); people with neither are not listed.
 * @param {{ holdings: Array<{ user_id: number, full_name: string, full_name_local?: string, holding: number, holding_entries: number, owed: number, owed_entries: number }>, t: Function, locale: string }} props
 */
export default function HoldingsCard({ holdings, t, locale }) {
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const held = holdings.reduce((s, p) => s + p.holding, 0);
    const owed = holdings.reduce((s, p) => s + p.owed, 0);
    return (
        <section id="holdings" className="scroll-mt-4">
            <Card title={t('fundraise.holdings.title')}>
                <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                    {holdings.length === 0 ? (
                        <p className="flex items-center justify-center gap-2 px-4 py-8 text-center text-sm text-ink-gray">
                            <HandCoins className="size-4" /> {t('fundraise.holdings.none')}
                        </p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {holdings.map((p) => (
                                <li key={p.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <Link href={`/members/${p.user_id}`} className="font-medium text-primary hover:underline break-words">
                                            {name(p)}
                                        </Link>
                                        <p className="text-xs text-ink-gray">
                                            {[
                                                p.holding_entries ? t('fundraise.holdings.keptCount', { count: p.holding_entries }) : null,
                                                p.owed_entries ? t('fundraise.holdings.paidCount', { count: p.owed_entries }) : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm tabular-nums">
                                        {p.holding > 0 && (
                                            <p>
                                                <span className="text-xs text-ink-gray">{t('fundraise.holdings.holds')}</span>{' '}
                                                <span className="font-semibold text-income">{money(p.holding)}</span>
                                            </p>
                                        )}
                                        {p.owed > 0 && (
                                            <p>
                                                <span className="text-xs text-ink-gray">{t('fundraise.holdings.toGetBack')}</span>{' '}
                                                <span className="font-semibold text-expense">{money(p.owed)}</span>
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {holdings.length > 1 && (
                        // Totals: all money not yet with the treasurer, and all the treasurer still owes back.
                        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 border-t border-surface-border bg-surface-content px-4 py-2 text-xs tabular-nums text-ink-gray">
                            {held > 0 && (
                                <span>
                                    {t('fundraise.holdings.holds')} <span className="font-semibold text-income">{money(held)}</span>
                                </span>
                            )}
                            {owed > 0 && (
                                <span>
                                    {t('fundraise.holdings.toGetBack')} <span className="font-semibold text-expense">{money(owed)}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </section>
    );
}
