'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { saveMandalContribution } from '@/app/actions/mandal';
import Combobox from '@/components/ui/combobox';
import ScheduleSelect from '@/components/mandal/schedule-select';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import Switch from '@/components/ui/switch';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];

/**
 * A Mandal's "+ Contribution" — short, not the fundraise form. Row 1: which member (this Mandal's own
 * members only, those who already paid at this schedule left out) — each with its record before this
 * schedule right in the list: what they still owe and absences in a row since they were added (nothing
 * recorded = absent). Row 2: amount (this schedule's amount per
 * member + what they owe, to start with) and mode. Row 3: which schedule (default: the latest) and
 * came?. Saved like one row of the attendance sheet (saveMandalContribution); the schedule's money
 * keeper keeps it, so there is no "Kept by" here.
 * `members`: [{ id, full_name, full_name_local }]; `schedules`: [{ value, label, installment, collect }];
 * `info`: eventId → memberId → { owed, missed, since, lastCame, held }.
 */
export default function MandalContributionDialog({ campaignId, members, schedules, defaultSchedule = null, info = {}, paid = {}, trigger }) {
    const { t, locale } = useT();
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    const [member, setMember] = useState(null);
    const [schedule, setSchedule] = useState(String(defaultSchedule ?? schedules[0]?.value ?? ''));
    const [came, setCame] = useState(true);
    const chosen = schedules.find((s) => String(s.value) === schedule);
    // Each member's record before this schedule, IN THE LIST (the grey line under the name): what they
    // still owe and their run of absences — plus the English name when the list shows the local one.
    const status = (m) => {
        const r = info[schedule]?.[m.id];
        return [
            r?.owed > 0 ? t('mandal.pendingFrom', { amount: money(r.owed) }) : t('mandal.noPending'),
            r?.missed > 0 ? t('mandal.absentRun', { count: r.missed }) : null,
            m.full_name !== name(m) ? m.full_name : null,
        ]
            .filter(Boolean)
            .join(' · ');
    };
    const options = members.map((m) => ({ value: String(m.id), label: name(m), hint: status(m), search: `${m.full_name} ${m.full_name_local ?? ''}` }));
    // One payment per member per schedule: whoever already paid at this schedule is not offered.
    const done = new Set((paid[schedule] ?? []).map(String));
    const available = options.filter((o) => !done.has(o.value));
    const picked = member && !done.has(member.value) ? member : null;
    const record = picked ? info[schedule]?.[picked.value] : null;
    const each = chosen?.collect ? Number(chosen.installment) || 0 : 0;
    const expected = each + (record?.owed ?? 0);
    // Type to search: filters this list in the browser (English and local name).
    const search = async (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return available;
        return available.filter((o) => o.search.toLowerCase().includes(needle));
    };
    return (
        <FormDialog
            title={t('fundraise.addContribution')}
            action={saveMandalContribution}
            hidden={{ campaign_id: campaignId }}
            submitIcon={Plus}
            submitVariant="income"
            submitLabel={t('common.add')}
            width="sm:max-w-md"
            trigger={
                trigger ??
                (({ open }) => (
                    <button
                        type="button"
                        onClick={open}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-income px-4 text-sm font-medium text-white hover:bg-income-hover"
                    >
                        <Plus className="size-4" /> {t('fundraise.addContribution')}
                    </button>
                ))
            }
        >
            {({ fieldError }) => (
                <div className="grid gap-3 sm:grid-cols-2">
                    {/* Row 1: the member — each one's dues / absences shown right in the list. */}
                    <Field label={t('mandal.member')} error={fieldError('user_id')} required className="sm:col-span-2">
                        <Combobox
                            key={schedule}
                            name="user_id"
                            value={picked?.value ?? ''}
                            valueLabel={picked?.label ?? ''}
                            onSelect={(opt) => setMember(opt)}
                            fetchOptions={search}
                            placeholder={t('mandal.searchMember')}
                            hasError={!!fieldError('user_id')}
                            emptyText={t('mandal.searchNone')}
                        />
                    </Field>
                    {/* Row 2: how much and how. Starts at this schedule's amount + what they still owe. */}
                    <Field label={t('fundraise.amount')} error={fieldError('amount')}>
                        <input
                            key={`${schedule}-${picked?.value ?? ''}`}
                            name="amount"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            defaultValue={expected > 0 ? expected : ''}
                            className={`${textInput(!!fieldError('amount'))} w-full tabular-nums`}
                        />
                    </Field>
                    <Field label={t('fundraise.mode')}>
                        <select name="mode" defaultValue="cash" className={`${selectInput()} w-full`}>
                            {MODES.map((m) => (
                                <option key={m} value={m}>
                                    {t(`fundraise.modes.${m}`)}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {/* Row 3: which schedule (default: the latest) and attendance. */}
                    <Field label={t('mandal.schedule')} error={fieldError('event_id')} required>
                        <ScheduleSelect
                            name="event_id"
                            options={schedules}
                            defaultValue={schedule}
                            onChange={(v) => setSchedule(v)}
                            hasError={!!fieldError('event_id')}
                        />
                    </Field>
                    <div className="sm:pt-7">
                        <Switch checked={came} onChange={setCame} name="present" label={t('mandal.present')} />
                    </div>
                </div>
            )}
        </FormDialog>
    );
}
