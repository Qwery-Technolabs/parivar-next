'use client';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveGroup } from '@/app/actions/groups';
import { Field, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import BilingualName from '@/components/ui/bilingual-name';
import { useT } from '@/lib/i18n/client';

export default function GroupFormDialog({ group, onNavy = false }) {
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
                    className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium ${
                        onNavy
                            ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                            : isEdit
                              ? 'btn-secondary w-full sm:w-auto'
                              : 'w-full bg-primary text-white hover:bg-primary/90 sm:w-auto'
                    }`}
                >
                    {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                    {isEdit ? t('common.edit') : t('groups.add')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <BilingualName
                        enLabel={t('groups.name')}
                        guLabel={t('groups.nameLocal')}
                        enName="name"
                        guName="name_local"
                        defaultEn={group?.name}
                        defaultGu={group?.name_local}
                        error={fieldError('name')}
                        required
                    />
                    <Field label={t('groups.description')}>
                        <textarea name="description" rows={3} defaultValue={group?.meta?.description ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
