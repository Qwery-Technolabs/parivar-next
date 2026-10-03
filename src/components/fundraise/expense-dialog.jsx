'use client';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { saveExpense } from '@/app/actions/fundraise';
import Combobox from '@/components/ui/combobox';
import Switch from '@/components/ui/switch';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
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
    const options = list.map((p) => ({ value: String(p.id), label: name(p) + (p.id === meId ? ` (${t('fundraise.you')})` : ''), hint: p.full_name !== name(p) ? p.full_name : undefined }));
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
export default function ExpenseDialog({ campaignId, today, categories = [], entry = null, trigger, people = [], meId = null }) {
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
                    {/* What and Where side by side (half each). */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('fundraise.expenseWhat')} error={fieldError('title')} required>
                            <input name="title" maxLength={200} defaultValue={entry?.title ?? ''} className={`${textInput(!!fieldError('title'))} w-full`} />
                        </Field>
                        <Field label={t('fundraise.expenseWhere')}>
                            <input name="place" maxLength={200} defaultValue={entry?.place ?? ''} className={`${textInput()} w-full`} />
                        </Field>
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
                        <Field label={t('fundraise.spentOn')} error={fieldError('spent_on')} required>
                            <input
                                type="date"
                                name="spent_on"
                                defaultValue={entry?.spent_on ?? today}
                                className={`${textInput(!!fieldError('spent_on'))} w-full`}
                            />
                        </Field>
                        <Field label={t('fundraise.category')} hint={t('common.optional')}>
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
                        <Field label={t('fundraise.billRef')} hint={t('common.optional')}>
                            <input name="bill_ref" maxLength={100} defaultValue={entry?.bill_ref ?? ''} className={`${textInput()} w-full`} />
                        </Field>
                    </div>
                    <Field label={t('common.notes')}>
                        <textarea name="notes" rows={3} defaultValue={entry?.notes ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                    {/* Who paid, and whether the treasurer has paid them back — after the notes. */}
                    <PaidBy people={people} entry={entry} meId={meId} fieldError={fieldError} />
                </>
            )}
        </FormDialog>
    );
}
