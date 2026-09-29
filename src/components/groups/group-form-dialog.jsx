'use client';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveGroup } from '@/app/actions/groups';
import AvatarPicker from '@/components/groups/avatar-picker';
import { Field, selectInput, textArea } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import BilingualName from '@/components/ui/bilingual-name';
import ChatRolesSelect from '@/components/groups/chat-roles-select';
import { chatRolesFrom } from '@/lib/group-roles';
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
                    {/* Picture first, left of the name — like a chat app's group info. */}
                    <div className="flex items-start gap-3">
                        <AvatarPicker name={group?.name} initial={group?.meta} />
                        <div className="min-w-0 flex-1 space-y-3">
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
                        </div>
                    </div>
                    {/* One row: who sees the group, and who may post in it. */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('groups.visibility.label')} hint={t('groups.visibility.hint')}>
                            <select name="visibility" defaultValue={group?.meta?.visibility || 'public'} className={`${selectInput()} w-full`}>
                                <option value="public">{t('groups.visibility.public')}</option>
                                <option value="private">{t('groups.visibility.private')}</option>
                            </select>
                        </Field>
                        <div className="min-w-0">
                            <span className="mb-1 block text-xs font-medium text-ink-gray">{t('groups.chatMode.label')}</span>
                            <ChatRolesSelect defaultValue={chatRolesFrom(group?.meta?.chat_roles, group?.meta?.chat_mode)} />
                            <p className="mt-1 text-xs text-ink-gray">{t('groups.chatMode.hint')}</p>
                        </div>
                    </div>
                    <Field label={t('groups.description')}>
                        <textarea name="description" rows={3} defaultValue={group?.meta?.description ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
