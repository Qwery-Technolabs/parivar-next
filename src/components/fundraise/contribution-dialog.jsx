'use client';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { saveContribution } from '@/app/actions/fundraise';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

// 'unpaid': pledged, money not in yet — listed as Pending, left out of the collected total.
const MODES = ['cash', 'upi', 'bank', 'cheque', 'other', 'unpaid'];

/**
 * Add a contribution, or edit one when `entry` (the row) is given. `trigger` overrides the
 * default button — the row menu passes one that opens the dialog as soon as it mounts.
 */
export default function ContributionDialog({ campaignId, today, allowAnonymous = true, entry = null, trigger }) {
    const { t } = useT();
    const editing = Boolean(entry);
    return (
        <FormDialog
            title={editing ? t('fundraise.editContribution') : t('fundraise.addContribution')}
            action={saveContribution}
            hidden={{ campaign_id: campaignId, contribution_id: entry?.id ?? '' }}
            submitIcon={editing ? Pencil : Plus}
            submitVariant="income"
            submitLabel={editing ? t('common.save') : t('common.add')}
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
                <ContributionFields fieldError={fieldError} today={today} allowAnonymous={allowAnonymous} entry={entry} />
            )}
        </FormDialog>
    );
}

function ContributionFields({ fieldError, today, allowAnonymous, entry }) {
    const { t } = useT();
    const [name, setName] = useState(entry?.donor_name ?? '');
    const [anon, setAnon] = useState(Boolean(Number(entry?.is_anonymous ?? 0)));
    return (
        <>
            <Field label={t('fundraise.donorMember')} hint={t('fundraise.donorHint')}>
                {/* Picking a member pre-fills the name; the name stays editable. */}
                <MemberPicker
                    name="user_id"
                    defaultValue={entry?.user_id ? { id: entry.user_id, label: entry.donor_name } : null}
                    // A phone number that is not a member can be invited; the name below becomes theirs.
                    allowInvite
                    onPick={(opt) => opt && !opt.invite && setName(opt.label)}
                />
            </Field>
            <Field label={t('fundraise.donor')} error={fieldError('donor_name')} required>
                <input
                    name="donor_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={150}
                    className={`${textInput(!!fieldError('donor_name'))} w-full`}
                />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fundraise.amount')} error={fieldError('amount')} required>
                    <input
                        name="amount"
                        inputMode="decimal"
                        defaultValue={entry?.amount ?? ''}
                        className={`${textInput(!!fieldError('amount'))} w-full tabular-nums`}
                    />
                </Field>
                <Field label={t('fundraise.paidOn')} error={fieldError('paid_on')} required>
                    <input
                        type="date"
                        name="paid_on"
                        defaultValue={entry?.paid_on ?? today}
                        className={`${textInput(!!fieldError('paid_on'))} w-full`}
                    />
                </Field>
                <Field label={t('fundraise.mode')}>
                    <select name="mode" defaultValue={entry?.mode ?? 'cash'} className={`${selectInput()} w-full`}>
                        {MODES.map((m) => (
                            <option key={m} value={m}>
                                {t(`fundraise.modes.${m}`)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={t('fundraise.reference')} hint={t('common.optional')}>
                    <input name="reference" maxLength={100} defaultValue={entry?.reference ?? ''} className={`${textInput()} w-full`} />
                </Field>
            </div>
            {allowAnonymous && <Switch checked={anon} onChange={setAnon} name="is_anonymous" label={t('fundraise.anonymous')} />}
        </>
    );
}
