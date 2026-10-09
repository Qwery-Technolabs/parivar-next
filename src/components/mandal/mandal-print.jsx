import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import GroupAvatar from '@/components/groups/group-avatar';
import PrintButton from '@/components/fundraise/print-button';
import Statement from '@/components/fundraise/statement';
import ChipLink from '@/components/ui/chip-link';
import { date } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { localized } from '@/lib/i18n/config';
import { MANDAL_VIEWS, mandalQuery } from '@/lib/mandal-filters';
import { getSettings, samajName } from '@/lib/settings';
import MandalScheduleSheets from './mandal-schedule-sheets';

const VIEW_LABEL = { contributors: 'fundraise.byContributor', schedules: 'mandal.bySchedules', expenses: 'fundraise.expenses' };
const SHOWS = ['all', 'present', 'absent'];
const SHOW_LABEL = { all: 'mandal.printEveryone', present: 'mandal.onlyPresent', absent: 'mandal.onlyAbsent' };

/**
 * A Mandal's printout / PDF (server component, outside the app shell) — the app's and the public link's.
 * Chips on top (each a link with a mini loader):
 *   View (one): By contributors (default) · By schedules · Expenses
 *   Print includes: All, or one or more schedule dates (multi-select; All clears them) — no date range
 *   Show (By schedules only): Everyone · Came only · Absent only
 * By contributors / Expenses are the fundraise statement's tables (Statement) over the chosen money; By
 * schedules is MandalScheduleSheets. `filters` from lib/mandal-filters (its mode sets the defaults),
 * `selected` the resolved schedule ids ([] = all), `sheets` every schedule's sheet, `statement` =
 * lib/mandal mandalStatement over the chosen ledger.
 */
export default async function MandalPrint({ campaign, filters, selected, sheets, statement, t, locale, backHref, basePath, publicView = false }) {
    const brand = samajName(await getSettings('admin'), locale) || t('app.name');
    const now = { ...filters, ids: selected, all: !selected.length };
    const href = (over) => {
        const q = mandalQuery(now, over);
        return q ? `${basePath}?${q}` : basePath;
    };
    const toggle = (id) => {
        const ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
        return href(ids.length ? { ids, all: false } : { ids: [], all: true });
    };
    const inRange = (d) => (!filters.from || d >= filters.from) && (!filters.to || d <= filters.to);
    const shown = selected.length ? sheets.filter((s) => selected.includes(s.e.id)) : sheets.filter((s) => inRange(s.e.start_date));
    const period = selected.length
        ? sheets
              .filter((s) => selected.includes(s.e.id))
              .map((s) => date(s.e.start_date, locale))
              .join(', ')
        : filters.from || filters.to
          ? `${filters.from ? date(filters.from, locale) : '…'} – ${filters.to ? date(filters.to, locale) : '…'}`
          : t('mandal.printAllShort');
    const chip = (on) =>
        `inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white text-ink-gray hover:text-primary'}`;
    const row = 'mx-auto flex max-w-4xl flex-wrap items-center gap-1.5 px-4 pb-2';
    const label = 'mr-1 text-xs font-medium text-ink-gray';
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
                {/* What to print — one view. */}
                <div className={row}>
                    <span className={label}>{t('mandal.printView')}</span>
                    {MANDAL_VIEWS.map((v) => (
                        <ChipLink key={v} href={href({ view: v })} on={filters.view === v} className={chip(filters.view === v)}>
                            {t(VIEW_LABEL[v])}
                        </ChipLink>
                    ))}
                </div>
                {/* Which money / schedules: all, or any of the dates. */}
                <div className={row}>
                    <span className={label}>{t('fundraise.printInclude')}</span>
                    <ChipLink href={href({ ids: [], all: true })} on={!selected.length} className={chip(!selected.length)}>
                        {t('mandal.printAllShort')}
                    </ChipLink>
                    {sheets.map(({ e }) => (
                        <ChipLink key={e.id} href={toggle(e.id)} on={selected.includes(e.id)} className={chip(selected.includes(e.id))}>
                            {date(e.start_date, locale)}
                        </ChipLink>
                    ))}
                </div>
                {/* By schedules: whom to list. */}
                {filters.view === 'schedules' && (
                    <div className={row}>
                        <span className={label}>{t('mandal.printShow')}</span>
                        {SHOWS.map((k) => (
                            <ChipLink key={k} href={href({ show: k })} on={filters.show === k} className={chip(filters.show === k)}>
                                {t(SHOW_LABEL[k])}
                            </ChipLink>
                        ))}
                    </div>
                )}
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
                        <p className="mt-0.5 text-xs text-ink-gray">
                            {t(VIEW_LABEL[filters.view])} · {period} · {t('fundraise.generatedOn', { date: date(todayLocal(), locale) })}
                        </p>
                    </div>
                </header>

                {filters.view === 'schedules' ? (
                    <MandalScheduleSheets shown={shown} show={filters.show} t={t} locale={locale} />
                ) : (
                    // The fundraise statement's own tables: By contributor, or Expenses — of the chosen money.
                    <Statement
                        campaign={statement.shownCampaign}
                        contributors={statement.contributors}
                        contributions={statement.contributions}
                        expenses={statement.expenses}
                        t={t}
                        locale={locale}
                        publicView={publicView}
                        sections={[filters.view]}
                    />
                )}
            </article>
        </div>
    );
}
