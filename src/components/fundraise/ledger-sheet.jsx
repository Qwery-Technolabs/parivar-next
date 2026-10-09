import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { date, money } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import PrintButton from './print-button';

/** One list: "amount  name" rows, a ----- rule, then the total. */
function Block({ heading, rows, nameOf, t }) {
    const sum = rows.reduce((acc, r) => acc + Number(r.amount), 0);
    return (
        <section className="mb-6">
            {heading && <h2 className="mb-1 text-sm font-semibold text-ink">{heading}</h2>}
            <table className="w-full text-sm">
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} className="align-top">
                            <td className="w-32 whitespace-nowrap py-0.5 pr-4 text-right tabular-nums">{money(r.amount)}</td>
                            <td className="break-words py-0.5">{nameOf(r)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={2} className="py-1 text-ink-gray">
                            -----
                        </td>
                    </tr>
                    <tr className="font-semibold">
                        <td className="w-32 whitespace-nowrap pr-4 text-right tabular-nums">{money(sum)}</td>
                        <td>{t('common.total')}</td>
                    </tr>
                </tbody>
            </table>
        </section>
    );
}

/**
 * The simple list statement for Save-as-PDF, same lines as the Copy text:
 *   amount  name / … / ----- / Total
 * A two-column table rather than a <pre>: monospace fonts have no Gujarati glyphs, so
 * padding with spaces would not line the names up.
 */
export default function LedgerSheet({ campaign, income, expense, kind, t, locale, backHref }) {
    const donor = (r) => (r.is_anonymous ? t('fundraise.anonymousLabel') : r.donor_name);
    const spend = (r) => [r.title, r.place].filter(Boolean).join(' — ');
    const sum = (rows) => rows.reduce((s, r) => s + Number(r.amount), 0);

    return (
        <div className="min-h-dvh bg-white">
            <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-surface-border bg-white px-4 py-2">
                <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    <ArrowLeft className="size-4" /> {t('common.back')}
                </Link>
                <PrintButton label={t('common.downloadPdf')} />
            </div>
            <main className="mx-auto max-w-2xl px-6 py-6 print:px-0">
                <h1 className="text-lg font-semibold text-ink">{localized(campaign, 'title', locale)}</h1>
                <p className="mb-5 text-xs text-ink-gray">{t('fundraise.generatedOn', { date: date(todayLocal(), locale) })}</p>
                {(kind === 'income' || kind === 'both') && (
                    <Block heading={kind === 'both' ? t('fundraise.contributions') : null} rows={income} nameOf={donor} t={t} />
                )}
                {(kind === 'expense' || kind === 'both') && (
                    <Block heading={kind === 'both' ? t('fundraise.expenses') : null} rows={expense} nameOf={spend} t={t} />
                )}
                {kind === 'both' && (
                    <p className="border-t border-ink pt-2 text-sm font-semibold">
                        {t('fundraise.balance')} <span className="tabular-nums">{money(sum(income) - sum(expense))}</span>
                    </p>
                )}
            </main>
        </div>
    );
}
