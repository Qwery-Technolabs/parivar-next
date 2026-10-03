'use client';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { saveContribution } from '@/app/actions/fundraise';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import Combobox from '@/components/ui/combobox';
import MemberPicker from '@/components/ui/member-picker';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

// 'unpaid': pledged, money not in yet — listed as Pending, left out of the collected total.
const MODES = ['cash', 'upi', 'bank', 'cheque', 'other', 'unpaid'];

/**
 * Add a contribution, or edit one when `entry` (the row) is given. `trigger` overrides the
 * default button — the row menu passes one that opens the dialog as soon as it mounts.
 */
export default function ContributionDialog({ campaignId, today, allowAnonymous = true, entry = null, trigger, people = [], meId = null, handDefault = false }) {
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
                <ContributionFields
                    fieldError={fieldError}
                    today={today}
                    allowAnonymous={allowAnonymous}
                    entry={entry}
                    people={people}
                    meId={meId}
                    handDefault={handDefault}
                />
            )}
        </FormDialog>
    );
}

/**
 * Who keeps the money (type to search; default: the person recording it) and whether it has been
 * handed to the treasurer — on by default for a treasurer or admin recording it (it is with the
 * treasurer already), off for a collector. `people`: the fundraise's team and group members.
 */
function KeptBy({ people, entry, meId, handDefault, fieldError }) {
    const { t, locale } = useT();
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const initial = entry?.kept_by ?? meId;
    const list = initial && !people.some((p) => p.id === initial) && entry?.kept_by_name ? [...people, { id: initial, full_name: entry.kept_by_name }] : people;
    const options = list.map((p) => ({ value: String(p.id), label: name(p) + (p.id === meId ? ` (${t('fundraise.you')})` : ''), hint: p.full_name !== name(p) ? p.full_name : undefined }));
    const [keeper, setKeeper] = useState(() => options.find((o) => o.value === String(initial ?? '')) ?? null);
    const [handed, setHanded] = useState(entry ? Boolean(entry.handed_over) : handDefault);
    const search = async (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((o) => o.label.toLowerCase().includes(needle) || (o.hint ?? '').toLowerCase().includes(needle));
    };
    return (
        // Top-aligned: when the search list opens (in the flow) the switch stays level with the box.
        <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label={t('fundraise.keptBy')} hint={t('fundraise.keptByHint')} error={fieldError('kept_by')} required>
                <Combobox
                    name="kept_by"
                    value={keeper?.value ?? ''}
                    valueLabel={keeper?.label ?? ''}
                    onSelect={(opt) => opt && setKeeper(opt)}
                    fetchOptions={search}
                    placeholder={t('fundraise.paidBySearch')}
                    hasError={!!fieldError('kept_by')}
                    emptyText={t('fundraise.paidByNone')}
                    clearable={false}
                />
            </Field>
            <div className="sm:pt-7">
                <Switch checked={handed} onChange={setHanded} name="handed_over" label={t('fundraise.handedSwitch')} />
                <p className="mt-1 text-xs text-ink-gray">{t('fundraise.handedHint')}</p>
            </div>
        </div>
    );
}

function ContributionFields({ fieldError, today, allowAnonymous, entry, people, meId, handDefault }) {
    const { t } = useT();
    const [name, setName] = useState(entry?.donor_name ?? '');
    const [anon, setAnon] = useState(Boolean(Number(entry?.is_anonymous ?? 0)));
    const [mode, setMode] = useState(entry?.mode ?? 'cash');
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
            {/* The name, with "Hide name publicly" on its right. */}
            <div className="grid items-start gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field label={t('fundraise.donor')} hint={t('fundraise.donorNameHint')} error={fieldError('donor_name')} required>
                    <input
                        name="donor_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={150}
                        placeholder={t('fundraise.donorNamePlaceholder')}
                        className={`${textInput(!!fieldError('donor_name'))} w-full`}
                    />
                </Field>
                {allowAnonymous && (
                    <div className="sm:pt-7">
                        <Switch checked={anon} onChange={setAnon} name="is_anonymous" label={t('fundraise.anonymous')} />
                    </div>
                )}
            </div>
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
                    <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={`${selectInput()} w-full`}>
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
            {/* Money in hand: who keeps it, and has it reached the treasurer? (Not for a pledge.) */}
            {mode !== 'unpaid' && <KeptBy people={people} entry={entry} meId={meId} handDefault={handDefault} fieldError={fieldError} />}
        </>
    );
}
