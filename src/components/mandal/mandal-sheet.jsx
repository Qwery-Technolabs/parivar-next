'use client';
import { ClipboardCheck, Save, Search } from 'lucide-react';
import { useState } from 'react';
import { saveMandalMeeting } from '@/app/actions/mandal';
import { selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';
import { money } from '@/lib/format';
import PendingList from './pending-list';

// How a member paid — the contribution modes, minus "Not paid" (what is not paid stays pending).
const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];

/**
 * "Attendance & money" for one Mandal meeting: collect money this time (yes / no) and the amount,
 * then per member — came? and paid. Each member shows what they still owed from earlier
 * meetings, so a returning member's pending amount is collected too.
 * `members`: [{ id, full_name, full_name_local }]; `marks`: userId → { present, paid };
 * `pending`: userId → amount owed before this meeting; `pendingList`: userId → its schedules (last 3 shown). Each payment has a mode (cash, UPI, …).
 */
export default function MandalSheet({ campaignId, meeting, members, marks, pending, pendingList = {} }) {
    const { t, locale } = useT();
    // Collect yes / no and the amount per member come from the schedule (About → Schedules → edit).
    const collect = Boolean(meeting.collect);
    const amount = String(meeting.installment || '');
    const [present, setPresent] = useState(() => Object.fromEntries(members.map((m) => [m.id, marks[m.id]?.present ?? false])));
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    const each = Number(amount) || 0;
    // Find a member by name (English or local); non-matching rows are only hidden, so every row still posts.
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const matches = (m) => !needle || [m.full_name, m.full_name_local].some((n) => (n ?? '').toLowerCase().includes(needle));
    const shown = members.filter(matches).length;
    return (
        <FormDialog
            title={t('mandal.sheetTitle')}
            description={[meeting.title_local && locale !== 'en' ? meeting.title_local : meeting.title, meeting.start_date, meeting.location]
                .filter(Boolean)
                .join(' · ')}
            action={saveMandalMeeting}
            hidden={{ campaign_id: campaignId, event_id: meeting.id }}
            submitIcon={Save}
            width="sm:max-w-2xl"
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    aria-label={t('mandal.sheet')}
                    title={t('mandal.sheet')}
                    className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                >
                    <ClipboardCheck className="size-3.5" /> <span className="hidden sm:inline">{t('mandal.sheet')}</span>
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <p className="rounded-md bg-accent px-3 py-2 text-sm text-primary tabular-nums">
                        {collect ? t('mandal.collectingEach', { amount: money(each) }) : t('mandal.notCollecting')}
                    </p>
                    {members.length === 0 ? (
                        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('mandal.noMembers')}</p>
                    ) : (
                        <>
                            {/* Search first, then came / paid on the row found — no scrolling through everyone. */}
                            <div>
                                <div className="relative">
                                    <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray" />
                                    <input
                                        type="search"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                        placeholder={t('mandal.searchMember')}
                                        aria-label={t('mandal.searchMember')}
                                        className={`${textInput()} w-full pl-8`}
                                    />
                                </div>
                                {needle && (
                                    <p className="mt-1 text-xs text-ink-gray tabular-nums">{t('mandal.searchShown', { shown, total: members.length })}</p>
                                )}
                            </div>
                            {/* A box of its own that scrolls, not a dialog as long as the member list. */}
                            <ul className="max-h-[50vh] divide-y divide-surface-border overflow-y-auto rounded-md border border-surface-border">
                                {members.map((m) => {
                                    const owed = pending[m.id] ?? 0;
                                    const expected = (collect ? each : 0) + owed;
                                    return (
                                        <li
                                            key={m.id}
                                            className={`${matches(m) ? 'grid' : 'hidden'} items-center gap-2 px-3 py-2 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_7rem_7rem]`}
                                        >
                                            <div className="col-span-3 min-w-0 sm:col-span-1">
                                                <p className="truncate text-sm font-medium text-primary">{name(m)}</p>
                                                <p className="text-xs text-ink-gray tabular-nums">
                                                    {owed > 0 ? (
                                                        <span className="font-medium text-destructive">{t('mandal.pendingFrom', { amount: money(owed) })}</span>
                                                    ) : (
                                                        t('mandal.noPending')
                                                    )}
                                                    {expected > 0 && <> · {t('mandal.expected', { amount: money(expected) })}</>}
                                                </p>
                                                <PendingList items={pendingList[m.id]} />
                                            </div>
                                            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                                                <input type="hidden" name={`present_${m.id}`} value={present[m.id] ? '1' : '0'} />
                                                <input
                                                    type="checkbox"
                                                    checked={present[m.id]}
                                                    onChange={(e) => setPresent((p) => ({ ...p, [m.id]: e.target.checked }))}
                                                    className="size-4 accent-brand-orange-strong"
                                                />
                                                {t('mandal.present')}
                                            </label>
                                            <input
                                                name={`paid_${m.id}`}
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="0.01"
                                                placeholder={t('mandal.paid')}
                                                aria-label={`${t('mandal.paid')} — ${name(m)}`}
                                                defaultValue={marks[m.id]?.paid ?? ''}
                                                className={`${textInput(!!fieldError(`paid_${m.id}`))} w-full tabular-nums`}
                                            />
                                            <select
                                                name={`mode_${m.id}`}
                                                aria-label={`${t('fundraise.mode')} — ${name(m)}`}
                                                defaultValue={marks[m.id]?.mode && MODES.includes(marks[m.id].mode) ? marks[m.id].mode : 'cash'}
                                                className={`${selectInput()} w-full`}
                                            >
                                                {MODES.map((x) => (
                                                    <option key={x} value={x}>
                                                        {t(`fundraise.modes.${x}`)}
                                                    </option>
                                                ))}
                                            </select>
                                        </li>
                                    );
                                })}
                                {needle && shown === 0 && <li className="px-3 py-4 text-center text-sm text-ink-gray">{t('mandal.searchNone')}</li>}
                            </ul>
                        </>
                    )}
                </>
            )}
        </FormDialog>
    );
}
