'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

/**
 * Holdings (About tab, under Team; everyone who sees the fundraise): where the money is, per person,
 * with an Income / Expense switch in the header (blue / orange, like the money tab's views).
 *   Income  — who holds the received money now (keepers; handed-over money is with the treasurer).
 *   Expense — who paid how much, and what the treasurer still owes them back.
 * The treasurer row is tagged (team treasurer, else its admin, else the creator). From listHoldings().
 * @param {{ holdings: { income: any[], expense: any[] } }} props
 */
export default function HoldingsCard({ holdings }) {
    const { t, locale } = useT();
    const [view, setView] = useState('income');
    const rows = holdings[view] ?? [];
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name || '—';
    const total = rows.reduce((s, p) => s + p.amount, 0);
    const tone = view === 'income' ? 'text-income' : 'text-expense';

    const toggle = (
        <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5" role="group" aria-label={t('fundraise.holdings.title')}>
            {['income', 'expense'].map((k) => (
                <button
                    key={k}
                    type="button"
                    onClick={() => setView(k)}
                    aria-pressed={view === k}
                    className={`inline-flex h-7 items-center rounded px-2.5 text-xs font-medium ${
                        view === k
                            ? `${k === 'expense' ? 'bg-expense' : 'bg-income'} text-white shadow-sm`
                            : `text-ink-gray ${k === 'expense' ? 'hover:text-expense' : 'hover:text-income'}`
                    }`}
                >
                    {t(`fundraise.holdings.${k}`)}
                </button>
            ))}
        </div>
    );

    return (
        <section id="holdings" className="scroll-mt-4">
            <Card title={t('fundraise.holdings.title')} actions={toggle}>
                <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                    {rows.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-ink-gray">{t(`fundraise.holdings.${view}Empty`)}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {rows.map((p) => (
                                <li key={p.user_id ?? 'none'} className="flex items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        {p.user_id ? (
                                            <Link href={`/members/${p.user_id}`} className="font-medium text-primary hover:underline break-words">
                                                {name(p)}
                                            </Link>
                                        ) : (
                                            <span className="font-medium text-primary">{name(p)}</span>
                                        )}
                                        {p.is_treasurer && (
                                            <Badge tone="green" className="ml-1.5">
                                                {t('fundraise.teamRoles.treasurer')}
                                            </Badge>
                                        )}
                                        <p className="text-xs text-ink-gray">
                                            {t(`fundraise.holdings.${view}Count`, { count: p.entries })}
                                            {view === 'income' && p.handed > 0 && <> · {t('fundraise.holdings.handedIn', { amount: money(p.handed) })}</>}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right tabular-nums">
                                        <p className={`text-sm font-semibold ${tone}`}>{money(p.amount)}</p>
                                        {view === 'expense' && p.to_get_back > 0 && (
                                            <p className="text-xs text-ink-gray">{t('fundraise.holdings.toGetBack', { amount: money(p.to_get_back) })}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {rows.length > 0 && (
                        <div className="flex justify-between gap-3 border-t border-surface-border bg-surface-content px-4 py-2 text-xs tabular-nums text-ink-gray">
                            <span>{t('common.total')}</span>
                            <span className={`font-semibold ${tone}`}>{money(total)}</span>
                        </div>
                    )}
                </div>
            </Card>
        </section>
    );
}
