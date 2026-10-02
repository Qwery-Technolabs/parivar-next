'use client';
import { ClipboardCheck, Save } from 'lucide-react';
import { useState } from 'react';
import { saveMandalMeeting } from '@/app/actions/mandal';
import { Field, selectInput, textInput } from '@/components/ui/field';
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
    const [collect, setCollect] = useState(meeting.collect);
    const [amount, setAmount] = useState(String(meeting.installment || ''));
    const [present, setPresent] = useState(() => Object.fromEntries(members.map((m) => [m.id, marks[m.id]?.present ?? false])));
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    const each = Number(amount) || 0;
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
                    <input type="hidden" name="collect" value={collect ? '1' : '0'} />
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <p className="mb-1 text-xs font-medium text-ink">{t('mandal.collect')}</p>
                            <div role="radiogroup" className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                                {[true, false].map((v) => (
                                    <button
                                        key={String(v)}
                                        type="button"
                                        role="radio"
                                        aria-checked={collect === v}
                                        onClick={() => setCollect(v)}
                                        className={`h-8 rounded px-3 text-xs font-medium ${collect === v ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-primary'}`}
                                    >
                                        {t(v ? 'common.yes' : 'common.no')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {collect && (
                            <Field label={t('mandal.amountThisTime')} error={fieldError('installment')}>
                                <input
                                    name="installment"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className={`${textInput(!!fieldError('installment'))} w-32 tabular-nums`}
                                />
                            </Field>
                        )}
                    </div>
                    {members.length === 0 ? (
                        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('mandal.noMembers')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
                            {members.map((m) => {
                                const owed = pending[m.id] ?? 0;
                                const expected = (collect ? each : 0) + owed;
                                return (
                                    <li
                                        key={m.id}
                                        className="grid items-center gap-2 px-3 py-2 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_7rem_7rem]"
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
                                            inputMode="decimal"
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
                        </ul>
                    )}
                </>
            )}
        </FormDialog>
    );
}
