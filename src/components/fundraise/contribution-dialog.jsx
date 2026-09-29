'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { addContribution } from '@/app/actions/fundraise';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];

export default function ContributionDialog({ campaignId, today, allowAnonymous = true }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('fundraise.addContribution')}
            action={addContribution}
            hidden={{ campaign_id: campaignId }}
            submitIcon={Plus}
            submitLabel={t('common.add')}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                    <Plus className="size-4" /> {t('fundraise.addContribution')}
                </button>
            )}
        >
            {({ fieldError }) => <ContributionFields fieldError={fieldError} today={today} allowAnonymous={allowAnonymous} />}
        </FormDialog>
    );
}

function ContributionFields({ fieldError, today, allowAnonymous }) {
    const { t } = useT();
    const [name, setName] = useState('');
    const [anon, setAnon] = useState(false);
    return (
        <>
            <Field label={t('fundraise.donorMember')} hint={t('fundraise.donorHint')}>
                {/* Picking a member pre-fills the name; the name stays editable. */}
                <MemberPicker name="user_id" onPick={(opt) => opt && setName(opt.label)} />
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
                    <input name="amount" inputMode="decimal" className={`${textInput(!!fieldError('amount'))} w-full tabular-nums`} />
                </Field>
                <Field label={t('fundraise.paidOn')} error={fieldError('paid_on')} required>
                    <input type="date" name="paid_on" defaultValue={today} className={`${textInput(!!fieldError('paid_on'))} w-full`} />
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
                <Field label={t('fundraise.reference')} hint={t('common.optional')}>
                    <input name="reference" maxLength={100} className={`${textInput()} w-full`} />
                </Field>
            </div>
            {allowAnonymous && <Switch checked={anon} onChange={setAnon} name="is_anonymous" label={t('fundraise.anonymous')} />}
        </>
    );
}
