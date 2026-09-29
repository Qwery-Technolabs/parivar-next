'use client';
import { Plus } from 'lucide-react';
import { createBloodRequest } from '@/app/actions/blood';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';
import { MenuOpener } from '@/components/shell/page-menu';

export default function PostRequestButton({ menuKey } = {}) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('blood.add')}
            action={createBloodRequest}
            submitLabel={t('blood.add')}
            submitIcon={Plus}
            trigger={({ open }) =>
                menuKey ? (
                    <MenuOpener id={menuKey} open={open} />
                ) : (
                <button
                    type="button"
                    onClick={open}
                    className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
                >
                    <Plus className="size-4" /> {t('blood.add')}
                </button>
                )
            }
        >
            {({ fieldError }) => (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('members.bloodGroup')} required error={fieldError('blood_group')}>
                            <select name="blood_group" defaultValue="" required className={`${selectInput(!!fieldError('blood_group'))} w-full`}>
                                <option value="" disabled>
                                    —
                                </option>
                                {BLOOD_GROUPS.map((g) => (
                                    <option key={g} value={g}>
                                        {g}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label={t('blood.units')} required error={fieldError('units')}>
                            <input
                                name="units"
                                type="number"
                                min={1}
                                max={20}
                                defaultValue={1}
                                required
                                className={`${textInput(!!fieldError('units'))} w-full tabular-nums`}
                            />
                        </Field>
                    </div>
                    <Field label={t('blood.patient')} required error={fieldError('patient_name')}>
                        <input name="patient_name" required maxLength={150} className={`${textInput(!!fieldError('patient_name'))} w-full`} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('blood.hospital')}>
                            <input name="hospital" maxLength={200} className={`${textInput()} w-full`} />
                        </Field>
                        <Field label={t('blood.city')}>
                            <input name="city" maxLength={100} className={`${textInput()} w-full`} />
                        </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('blood.contact')} required error={fieldError('contact_phone')}>
                            <input
                                name="contact_phone"
                                type="tel"
                                inputMode="numeric"
                                required
                                className={`${textInput(!!fieldError('contact_phone'))} w-full tabular-nums`}
                            />
                        </Field>
                        <Field label={t('blood.neededBy')} error={fieldError('needed_by')}>
                            <input name="needed_by" type="date" className={`${textInput(!!fieldError('needed_by'))} w-full`} />
                        </Field>
                    </div>
                    <Field label={t('common.notes')}>
                        <textarea name="notes" maxLength={2000} className={`${textArea()} w-full`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
