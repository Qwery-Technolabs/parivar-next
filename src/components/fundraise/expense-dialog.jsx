'use client';
import { Plus } from 'lucide-react';
import { addExpense } from '@/app/actions/fundraise';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

export default function ExpenseDialog({ campaignId, today, categories = [] }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('fundraise.addExpense')}
            action={addExpense}
            hidden={{ campaign_id: campaignId }}
            submitIcon={Plus}
            submitLabel={t('common.add')}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                >
                    <Plus className="size-4" /> {t('fundraise.addExpense')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('fundraise.expenseWhat')} error={fieldError('title')} required>
                        <input name="title" maxLength={200} className={`${textInput(!!fieldError('title'))} w-full`} />
                    </Field>
                    <Field label={t('fundraise.expenseWhere')}>
                        <input name="place" maxLength={200} className={`${textInput()} w-full`} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('fundraise.amount')} error={fieldError('amount')} required>
                            <input name="amount" inputMode="decimal" className={`${textInput(!!fieldError('amount'))} w-full tabular-nums`} />
                        </Field>
                        <Field label={t('fundraise.spentOn')} error={fieldError('spent_on')} required>
                            <input type="date" name="spent_on" defaultValue={today} className={`${textInput(!!fieldError('spent_on'))} w-full`} />
                        </Field>
                        <Field label={t('fundraise.category')} hint={t('common.optional')}>
                            {/* Categories come from fundraise_settings.expense_categories. */}
                            <select name="category" defaultValue="" className={`${selectInput()} w-full`}>
                                <option value="">{t('common.none')}</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label={t('fundraise.billRef')} hint={t('common.optional')}>
                            <input name="bill_ref" maxLength={100} className={`${textInput()} w-full`} />
                        </Field>
                    </div>
                    <Field label={t('common.notes')}>
                        <textarea name="notes" rows={3} className={`${textArea()} w-full`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
