import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import GroupAvatar from '@/components/groups/group-avatar';
import PrintButton from '@/components/fundraise/print-button';
import { date } from '@/lib/format';
import MandalScheduleSheets from './mandal-schedule-sheets';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { getSettings, samajName } from '@/lib/settings';

/**
 * A Mandal's printout / PDF (server component, outside the app shell) — the app's and the public link's:
 * ALL schedules, or ONE (`selected` = a schedule id), and Everyone / Came only / Absent only (`show`) —
 * chosen with the chips on top; the sheets themselves are MandalScheduleSheets.
 * `schedules`: [{ e, sheet, forThem }] (lib/mandal `mandalSheets`).
 */
export default async function MandalPrint({ campaign, schedules, selected = null, show = 'all', t, locale, backHref, basePath, keep = {} }) {
    const brand = samajName(await getSettings('admin'), locale) || t('app.name');
    const shown = selected ? schedules.filter((s) => s.e.id === selected) : schedules;
    const href = (sched, sh) => {
        // `keep`: other filters the links carry along (the public link's date range).
        const q = new URLSearchParams(keep);
        if (sched) q.set('schedule', String(sched));
        if (sh !== 'all') q.set('show', sh);
        return q.size ? `${basePath}?${q}` : basePath;
    };
    const chip = (on) =>
        `inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white text-ink-gray hover:text-primary'}`;
    return (
        <div className="min-h-dvh bg-surface-login print:bg-white">
            <style>{'@page { size: A4; margin: 12mm; } @media print { body { font-size: 11px; } }'}</style>
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
                    <Link href={href(null, show)} replace scroll={false} aria-pressed={!selected} className={chip(!selected)}>
                        {!selected && <Check className="size-3.5" />}
                        {t('mandal.printAll')}
                    </Link>
                    {schedules.map(({ e }) => (
                        <Link key={e.id} href={href(e.id, show)} replace scroll={false} aria-pressed={selected === e.id} className={chip(selected === e.id)}>
                            {selected === e.id && <Check className="size-3.5" />}
                            {date(e.start_date, locale)}
                        </Link>
                    ))}
                </div>
                {/* Whom to list: everyone, only those who came, or only the absent — a shorter printout. */}
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5 px-4 pb-2">
                    <span className="mr-1 text-xs font-medium text-ink-gray">{t('mandal.printShow')}</span>
                    {['all', 'present', 'absent'].map((k) => (
                        <Link key={k} href={href(selected, k)} replace scroll={false} aria-pressed={show === k} className={chip(show === k)}>
                            {show === k && <Check className="size-3.5" />}
                            {t(k === 'all' ? 'mandal.printEveryone' : k === 'present' ? 'mandal.onlyPresent' : 'mandal.onlyAbsent')}
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

                <MandalScheduleSheets shown={shown} show={show} t={t} locale={locale} />
            </article>
        </div>
    );
}
