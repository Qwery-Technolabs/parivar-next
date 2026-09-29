'use client';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveGroup } from '@/app/actions/groups';
import { Field, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

export default function GroupFormDialog({ group }) {
    const { t } = useT();
    const router = useRouter();
    const isEdit = Boolean(group);
    return (
        <FormDialog
            title={isEdit ? t('common.edit') : t('groups.add')}
            action={saveGroup}
            hidden={isEdit ? { id: group.id } : {}}
            submitIcon={isEdit ? Pencil : Plus}
            onSuccess={(res) => !isEdit && router.push(`/groups/${res.id}`)}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className={`inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium sm:w-auto ${
                        isEdit
                            ? 'border border-surface-border bg-white text-primary hover:bg-accent'
                            : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                >
                    {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                    {isEdit ? t('common.edit') : t('groups.add')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('groups.name')} error={fieldError('name')} required>
                        <input name="name" defaultValue={group?.name ?? ''} required maxLength={150} className={`${textInput(!!fieldError('name'))} w-full`} />
                    </Field>
                    <Field label={t('groups.nameGu')}>
                        <input name="name_gu" lang="gu" defaultValue={group?.name_gu ?? ''} maxLength={150} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('groups.description')}>
                        <textarea name="description" rows={3} defaultValue={group?.meta?.description ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
