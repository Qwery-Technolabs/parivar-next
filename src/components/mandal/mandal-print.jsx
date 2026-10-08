import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import GroupAvatar from '@/components/groups/group-avatar';
import PrintButton from '@/components/fundraise/print-button';
import { date, money } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { getSettings, samajName } from '@/lib/settings';

/**
 * A Mandal's printout / PDF (server component, outside the app shell): ALL schedules, or ONE
 * (`selected` = a schedule id) — chosen with the chips on top. Per schedule: date, place, amount per
 * person, who keeps the money; then each member — came, paid, mode — with the totals.
 * `schedules`: [{ e, sheet, forThem }] as built by the Savings tab (lib/mandal).
 */
export default async function MandalPrint({ campaign, schedules, selected = null, t, locale, backHref, basePath }) {
    const brand = samajName(await getSettings('admin'), locale) || t('app.name');
    const name = (p) => localized(p, 'full_name', locale);
    const shown = selected ? schedules.filter((s) => s.e.id === selected) : schedules;
    const chip = (on) =>
        `inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white text-ink-gray hover:text-primary'}`;
    return (
        <div className="min-h-dvh bg-surface-login print:bg-white">
            <style>{'@page { size: A4; margin: 12mm; } @media print { body { font-size: 11px; } .mandal-schedule { break-inside: avoid; } }'}</style>
            <div className="no-print sticky top-0 z-10 border-b border-surface-border bg-white">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2">
                    <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        <ArrowLeft className="size-4" /> {t('common.back')}
                    </Link>
                    <PrintButton label={t('common.downloadPdf')} />
                </div>
                {/* What to print: everything, or one schedule (date). */}
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5 px-4 pb-2">
                    <span className="mr-1 text-xs font-medium text-ink-gray">{t('fundraise.printInclude')}</span>
                    <Link href={basePath} replace scroll={false} aria-pressed={!selected} className={chip(!selected)}>
                        {!selected && <Check className="size-3.5" />}
                        {t('mandal.printAll')}
                    </Link>
                    {schedules.map(({ e }) => (
                        <Link
                            key={e.id}
                            href={`${basePath}?schedule=${e.id}`}
                            replace
                            scroll={false}
                            aria-pressed={selected === e.id}
                            className={chip(selected === e.id)}
                        >
                            {selected === e.id && <Check className="size-3.5" />}
                            {date(e.start_date, locale)}
                        </Link>
                    ))}
                </div>
            </div>
            <article className="theme-fundraise mx-auto my-4 max-w-4xl rounded-lg border border-surface-border bg-white p-6 shadow-sm print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8">
                <header className="mb-5 flex items-start gap-3 border-b-2 border-primary pb-3">
                    <GroupAvatar
                        id={campaign.id}
                        name={campaign.title}
                        kind={campaign.meta?.avatar_kind}
                        value={campaign.meta?.avatar_value}
                        color={campaign.meta?.avatar_color}
                        size="lg"
                        className="mt-1"
                    />
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">
                            {brand} · {t('mandal.badge')}
                        </p>
                        <h1 className="mt-1 text-lg font-semibold text-primary break-words">{localized(campaign, 'title', locale)}</h1>
                        <p className="mt-0.5 text-xs text-ink-gray">{t('fundraise.generatedOn', { date: date(todayLocal(), locale) })}</p>
                    </div>
                </header>

                {shown.length === 0 ? (
                    <p className="text-sm text-ink-gray">{t('mandal.noSchedulesSavings')}</p>
                ) : (
                    <div className="space-y-6">
                        {shown.map(({ e, sheet, forThem }) => {
                            const paidTotal = forThem.reduce((s, m) => s + Number(sheet[m.id]?.paid || 0), 0);
                            const came = forThem.filter((m) => sheet[m.id]?.present).length;
                            return (
                                <section key={e.id} className="mandal-schedule">
                                    <h2 className="text-sm font-semibold text-primary">
                                        {date(e.start_date, locale)} - {t('mandal.word')}
                                    </h2>
                                    <p className="mb-2 text-xs text-ink-gray tabular-nums">
                                        {[
                                            e.location,
                                            e.collect ? t('mandal.perPersonAmount', { amount: money(e.installment) }) : t('mandal.notCollecting'),
                                            e.holder ? t('mandal.moneyWith', { name: name(e.holder) }) : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-gray">
                                                <th className="w-8 py-1.5 pr-2 font-medium">#</th>
                                                <th className="py-1.5 pr-2 font-medium">{t('mandal.members')}</th>
                                                <th className="w-20 py-1.5 pr-2 text-center font-medium">{t('mandal.present')}</th>
                                                <th className="w-24 py-1.5 pr-2 text-right font-medium">{t('mandal.paid')}</th>
                                                <th className="w-24 py-1.5 font-medium">{t('fundraise.mode')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {forThem.map((m, i) => {
                                                const mark = sheet[m.id] ?? {};
                                                const paid = Number(mark.paid || 0);
                                                return (
                                                    <tr key={m.id} className="border-b border-surface-border/60">
                                                        <td className="py-1.5 pr-2 text-ink-gray tabular-nums">{i + 1}</td>
                                                        <td className="py-1.5 pr-2 text-primary">{name(m)}</td>
                                                        <td className="py-1.5 pr-2 text-center">{mark.present ? '✓' : '–'}</td>
                                                        <td
                                                            className={`py-1.5 pr-2 text-right tabular-nums ${paid > 0 ? 'font-medium text-income' : 'text-ink-gray'}`}
                                                        >
                                                            {paid > 0 ? money(paid) : '–'}
                                                        </td>
                                                        <td className="py-1.5 text-ink-gray">
                                                            {paid > 0 && mark.mode ? t(`fundraise.modes.${mark.mode}`) : ''}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-primary font-semibold">
                                                <td />
                                                <td className="py-1.5 pr-2 text-primary">{t('common.total')}</td>
                                                <td className="py-1.5 pr-2 text-center tabular-nums">
                                                    {t('mandal.cameCount', { came, total: forThem.length })}
                                                </td>
                                                <td className="py-1.5 pr-2 text-right text-income tabular-nums">{money(paidTotal)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </section>
                            );
                        })}
                    </div>
                )}
            </article>
        </div>
    );
}
