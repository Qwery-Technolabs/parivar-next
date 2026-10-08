'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { saveMandalContribution } from '@/app/actions/mandal';
import Combobox from '@/components/ui/combobox';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];

/**
 * A Mandal's "+ Contribution" — short, not the fundraise form: which member (this Mandal's own
 * members only), which schedule (default: the latest), came?, amount (the schedule's amount per member
 * to start with) and mode. Saved like one row of the attendance sheet (saveMandalContribution); the
 * schedule's money keeper keeps it, so there is no "Kept by" here.
 * `members`: [{ id, full_name, full_name_local }]; `schedules`: [{ value, label, installment, collect }].
 */
export default function MandalContributionDialog({ campaignId, members, schedules, defaultSchedule = null, trigger }) {
    const { t, locale } = useT();
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    const options = members.map((m) => ({ value: String(m.id), label: name(m), hint: m.full_name !== name(m) ? m.full_name : undefined }));
    const [member, setMember] = useState(null);
    const [schedule, setSchedule] = useState(String(defaultSchedule ?? schedules[0]?.value ?? ''));
    const [came, setCame] = useState(true);
    const chosen = schedules.find((s) => String(s.value) === schedule);
    // Type to search: filters this list in the browser (English and local name).
    const search = async (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((o) => o.label.toLowerCase().includes(needle) || (o.hint ?? '').toLowerCase().includes(needle));
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
                    <Field label={t('mandal.member')} error={fieldError('user_id')} required className="sm:col-span-2">
                        <Combobox
                            name="user_id"
                            value={member?.value ?? ''}
                            valueLabel={member?.label ?? ''}
                            onSelect={(opt) => setMember(opt)}
                            fetchOptions={search}
                            placeholder={t('mandal.searchMember')}
                            hasError={!!fieldError('user_id')}
                            emptyText={t('mandal.searchNone')}
                        />
                    </Field>
                    <Field label={t('mandal.schedule')} error={fieldError('event_id')} required>
                        <select
                            name="event_id"
                            value={schedule}
                            onChange={(e) => setSchedule(e.target.value)}
                            className={`${selectInput(!!fieldError('event_id'))} w-full`}
                        >
                            {schedules.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div className="sm:pt-7">
                        <Switch checked={came} onChange={setCame} name="present" label={t('mandal.present')} />
                    </div>
                    <Field label={t('fundraise.amount')} error={fieldError('amount')}>
                        {/* Starts at the schedule's amount per member; a new schedule resets it. */}
                        <input
                            key={schedule}
                            name="amount"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            defaultValue={chosen?.collect && chosen.installment ? chosen.installment : ''}
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
                </div>
            )}
        </FormDialog>
    );
}
