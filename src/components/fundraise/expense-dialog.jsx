'use client';
import { Pencil, Plus } from 'lucide-react';
import { saveExpense } from '@/app/actions/fundraise';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

/** Add an expense, or edit one when `entry` (the row, with notes / bill_ref) is given. */
export default function ExpenseDialog({ campaignId, today, categories = [], entry = null, trigger }) {
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
                    <Field label={t('fundraise.expenseWhat')} error={fieldError('title')} required>
                        <input name="title" maxLength={200} defaultValue={entry?.title ?? ''} className={`${textInput(!!fieldError('title'))} w-full`} />
                    </Field>
                    <Field label={t('fundraise.expenseWhere')}>
                        <input name="place" maxLength={200} defaultValue={entry?.place ?? ''} className={`${textInput()} w-full`} />
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
                </>
            )}
        </FormDialog>
    );
}
