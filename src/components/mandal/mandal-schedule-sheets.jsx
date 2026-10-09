import { date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';

/**
 * A Mandal's schedules as sheets (server component, no hooks): per schedule its date, place, amount per
 * person and who keeps the money, then each member — came, paid, mode — with the totals (always for the
 * whole schedule). `show`: 'all' | 'present' | 'absent' — list only those who came / did not (nothing
 * recorded = absent). Used by the Mandal print / PDF and the public link's page.
 * `shown`: [{ e, sheet, forThem }] (lib/mandal `mandalSheets`).
 */
export default function MandalScheduleSheets({ shown, show = 'all', t, locale }) {
    const name = (p) => localized(p, 'full_name', locale);
    const keep = (sheet, m) => (show === 'present' ? Boolean(sheet[m.id]?.present) : show === 'absent' ? !sheet[m.id]?.present : true);
    return (
        <>
            {shown.length === 0 ? (
                <p className="text-sm text-ink-gray">{t('mandal.noSchedulesSavings')}</p>
            ) : (
                <div className="space-y-6">
                    {shown.map(({ e, sheet, forThem }) => {
                        const paidTotal = forThem.reduce((s, m) => s + Number(sheet[m.id]?.paid || 0), 0);
                        const came = forThem.filter((m) => sheet[m.id]?.present).length;
                        return (
                            <section key={e.id}>
                                <h2 className="text-sm font-semibold text-primary">
                                    {date(e.start_date, locale)} - {t('mandal.word')}
                                </h2>
                                <p className="print-keep-next mb-2 text-xs text-ink-gray tabular-nums">
                                    {[
                                        show !== 'all' ? t(show === 'present' ? 'mandal.onlyPresent' : 'mandal.onlyAbsent') : null,
                                        e.location,
                                        e.collect ? t('mandal.perPersonAmount', { amount: money(e.installment) }) : t('mandal.notCollecting'),
                                        e.holder ? t('mandal.moneyWith', { name: name(e.holder) }) : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                                <div className="overflow-hidden rounded-lg border border-surface-border bg-white print:overflow-visible print:rounded-none">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-surface-border bg-surface-login text-left text-xs uppercase tracking-wide text-ink-gray">
                                                <th className="w-10 px-4 py-2.5 font-semibold">#</th>
                                                <th className="px-4 py-2.5 font-semibold">{t('mandal.members')}</th>
                                                <th className="w-24 px-4 py-2.5 text-center font-semibold">{t('mandal.present')}</th>
                                                <th className="w-28 px-4 py-2.5 text-right font-semibold">{t('mandal.paid')}</th>
                                                <th className="w-28 px-4 py-2.5 font-semibold">{t('fundraise.mode')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {forThem
                                                .filter((m) => keep(sheet, m))
                                                .map((m, i) => {
                                                    const mark = sheet[m.id] ?? {};
                                                    const paid = Number(mark.paid || 0);
                                                    return (
                                                        <tr key={m.id} className="border-b border-surface-border last:border-0">
                                                            <td className="px-4 py-2 text-ink-gray tabular-nums">{i + 1}</td>
                                                            <td className="px-4 py-2 text-primary">{name(m)}</td>
                                                            <td className={`px-4 py-2 text-center ${mark.present ? 'text-emerald-700' : 'text-ink-gray'}`}>
                                                                {mark.present ? '✓' : '–'}
                                                            </td>
                                                            <td
                                                                className={`px-4 py-2 text-right tabular-nums ${paid > 0 ? 'font-medium text-income' : 'text-ink-gray'}`}
                                                            >
                                                                {paid > 0 ? money(paid) : '–'}
                                                            </td>
                                                            <td className="px-4 py-2 text-ink-gray">
                                                                {paid > 0 && mark.mode ? t(`fundraise.modes.${mark.mode}`) : ''}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-surface-border bg-surface-login font-semibold">
                                                <td />
                                                <td className="px-4 py-2 text-primary">{t('common.total')}</td>
                                                <td className="px-4 py-2 text-center text-primary tabular-nums">
                                                    {t('mandal.cameCount', { came, total: forThem.length })}
                                                </td>
                                                <td className="px-4 py-2 text-right text-income tabular-nums">{money(paidTotal)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </>
    );
}
