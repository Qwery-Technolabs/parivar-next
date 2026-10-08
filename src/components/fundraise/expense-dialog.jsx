'use client';
import { FileText, HandCoins, Pencil, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { saveExpense } from '@/app/actions/fundraise';
import Combobox from '@/components/ui/combobox';
import Switch from '@/components/ui/switch';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import FormPart from '@/components/ui/form-part';
import ScheduleSelect from '@/components/mandal/schedule-select';
import { useT } from '@/lib/i18n/client';

/**
 * Paid by (who paid out of pocket — default: the person recording it) and whether the treasurer has
 * paid them back (default off). Its own component so its state remounts with the dialog's form.
 * `people`: [{ id, full_name, full_name_local }] — the fundraise's team and group members.
 */
function PaidBy({ people, entry, meId, fieldError }) {
    const { t, locale } = useT();
    const [repaid, setRepaid] = useState(Boolean(entry?.repaid));
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const initial = entry?.paid_by ?? meId;
    // A payer no longer in the list (left the group) still shows, so editing never drops them.
    const list = initial && !people.some((p) => p.id === initial) && entry?.paid_by_name ? [...people, { id: initial, full_name: entry.paid_by_name }] : people;
    const options = list.map((p) => ({
        value: String(p.id),
        label: name(p) + (p.id === meId ? ` (${t('fundraise.you')})` : ''),
        hint: p.full_name !== name(p) ? p.full_name : undefined,
    }));
    const [payer, setPayer] = useState(() => options.find((o) => o.value === String(initial ?? '')) ?? null);
    // Type to search: filters this list in the browser (English and local name), no server call.
    const search = async (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((o) => o.label.toLowerCase().includes(needle) || (o.hint ?? '').toLowerCase().includes(needle));
    };
    return (
        // Top-aligned: when the search list opens (in the flow) the switch stays level with the box.
        <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label={t('fundraise.paidBy')} hint={t('fundraise.paidByHint')} error={fieldError('paid_by')} required>
                <Combobox
                    name="paid_by"
                    value={payer?.value ?? ''}
                    valueLabel={payer?.label ?? ''}
                    onSelect={(opt) => opt && setPayer(opt)}
                    fetchOptions={search}
                    placeholder={t('fundraise.paidBySearch')}
                    hasError={!!fieldError('paid_by')}
                    emptyText={t('fundraise.paidByNone')}
                    clearable={false}
                />
            </Field>
            <div className="sm:pt-7">
                <Switch checked={repaid} onChange={setRepaid} name="repaid" label={t('fundraise.repaidSwitch')} />
                <p className="mt-1 text-xs text-ink-gray">{t('fundraise.repaidHint')}</p>
            </div>
        </div>
    );
}

/** Add an expense, or edit one when `entry` (the row, with notes / bill_ref / paid_by / repaid) is given. */
/** `schedules` (a Mandal only): [{ value: eventId, label }] — adds the optional "For schedule" choice. */
export default function ExpenseDialog({
    campaignId,
    today,
    categories = [],
    entry = null,
    trigger,
    people = [],
    meId = null,
    schedules = null,
    defaultSchedule = null,
}) {
    const { t } = useT();
    const editing = Boolean(entry);
    // A stored category removed from settings since still shows, so editing never drops it.
    const options = entry?.category && !categories.includes(entry.category) ? [...categories, entry.category] : categories;
    return (
        <FormDialog
            title={editing ? t('fundraise.editExpense') : t('fundraise.addExpense')}
            action={saveExpense}
            hidden={{ campaign_id: campaignId, expense_id: entry?.id ?? '' }}
            submitIcon={editing ? Pencil : Plus}
            submitVariant="expense"
            submitLabel={editing ? t('common.save') : t('common.add')}
            trigger={
                trigger ??
                (({ open }) => (
                    <button
                        type="button"
                        onClick={open}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-expense px-4 text-sm font-medium text-white hover:bg-expense-hover"
                    >
                        <Plus className="size-4" /> {t('fundraise.addExpense')}
                    </button>
                ))
            }
        >
            {({ fieldError }) => (
                <>
                    {/* Details: what and where (half each) and notes. */}
                    <FormPart title={t('fundraise.parts.details')} icon={FileText} className="border-t-0 pt-0">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t('fundraise.expenseWhat')} error={fieldError('title')} required>
                                <input
                                    name="title"
                                    maxLength={200}
                                    defaultValue={entry?.title ?? ''}
                                    placeholder={t('fundraise.expenseWhatPlaceholder')}
                                    className={`${textInput(!!fieldError('title'))} w-full`}
                                />
                            </Field>
                            <Field label={t('fundraise.expenseWhere')}>
                                <input
                                    name="place"
                                    maxLength={200}
                                    defaultValue={entry?.place ?? ''}
                                    placeholder={t('fundraise.expenseWherePlaceholder')}
                                    className={`${textInput()} w-full`}
                                />
                            </Field>
                        </div>
                        {/* A Mandal: the expense comes out of the common savings, optionally for one schedule. */}
                        {schedules && (
                            <Field label={`${t('mandal.forSchedule')} (${t('common.optional')})`} className="mt-3">
                                <ScheduleSelect
                                    name="event_id"
                                    options={schedules}
                                    defaultValue={entry ? (entry.event_id ?? '') : (defaultSchedule ?? '')}
                                    allowEmpty
                                    emptyLabel={t('mandal.commonSavings')}
                                />
                            </Field>
                        )}
                    </FormPart>
                    <FormPart title={t('fundraise.parts.amount')} icon={Wallet}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t('fundraise.amount')} error={fieldError('amount')} required>
                                <input
                                    name="amount"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    defaultValue={entry?.amount ?? ''}
                                    className={`${textInput(!!fieldError('amount'))} w-full tabular-nums`}
                                />
                            </Field>
                            <Field label={t('fundraise.spentOn')} error={fieldError('spent_on')} required>
                                <input
                                    type="date"
                                    name="spent_on"
                                    defaultValue={entry?.spent_on ?? today}
                                    className={`${textInput(!!fieldError('spent_on'))} w-full`}
                                />
                            </Field>
                            <Field label={`${t('fundraise.category')} (${t('common.optional')})`}>
                                {/* Categories come from fundraise_settings.expense_categories. */}
                                <select name="category" defaultValue={entry?.category ?? ''} className={`${selectInput()} w-full`}>
                                    <option value="">{t('common.none')}</option>
                                    {options.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={`${t('fundraise.billRef')} (${t('common.optional')})`}>
                                <input name="bill_ref" maxLength={100} defaultValue={entry?.bill_ref ?? ''} className={`${textInput()} w-full`} />
                            </Field>
                        </div>
                        <Field label={t('common.notes')} className="mt-3">
                            <textarea
                                name="notes"
                                rows={3}
                                defaultValue={entry?.notes ?? ''}
                                placeholder={t('fundraise.notesPlaceholder')}
                                className={`${textArea()} w-full`}
                            />
                        </Field>
                    </FormPart>
                    {/* Holding: who paid, and whether the treasurer has paid them back. */}
                    <FormPart title={t('fundraise.parts.holding')} icon={HandCoins}>
                        <PaidBy people={people} entry={entry} meId={meId} fieldError={fieldError} />
                    </FormPart>
                </>
            )}
        </FormDialog>
    );
}
