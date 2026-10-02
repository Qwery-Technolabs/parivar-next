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
import { MenuOpener } from '@/components/shell/page-menu';

export default function GroupFormDialog({ group, onNavy = false, menuKey }) {
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
            trigger={({ open }) =>
                menuKey ? (
                    <MenuOpener id={menuKey} open={open} />
                ) : (
                <button
                    type="button"
                    onClick={open}
                    // On the navy header: icon only on phones (the title needs the room), icon + text from sm up.
                    aria-label={onNavy ? t('common.edit') : undefined}
                    title={onNavy ? t('common.edit') : undefined}
                    className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium ${
                        onNavy
                            ? 'w-9 border border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto sm:px-3'
                            : isEdit
                              ? 'btn-secondary w-full px-3 sm:w-auto'
                              : 'w-full bg-primary px-3 text-white hover:bg-primary/90 sm:w-auto'
                    }`}
                >
                    {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                    <span className={onNavy ? 'hidden sm:inline' : undefined}>{isEdit ? t('common.edit') : t('groups.add')}</span>
                </button>
                )
            }
        >
            {({ fieldError }) => (
                <>
                    {/* Picture first, left of the name — like a chat app's group info. */}
                    <div className="flex items-start gap-3">
                        <AvatarPicker name={group?.name} initial={group?.meta} />
                        <div className="min-w-0 flex-1 space-y-3">
                            <BilingualName
                                enLabel={t('groups.name')}
                                example="groupName"
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
                    {/* Visibility a quarter of the row, posting roles the other three quarters. */}
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Field label={t('groups.visibility.label')} hint={t('groups.visibility.hint')} className="sm:col-span-1">
                            <select name="visibility" defaultValue={group?.meta?.visibility || 'public'} className={`${selectInput()} w-full`}>
                                <option value="public">{t('groups.visibility.public')}</option>
                                <option value="private">{t('groups.visibility.private')}</option>
                            </select>
                        </Field>
                        <div className="min-w-0 sm:col-span-3">
                            <span className="mb-1 block text-xs font-medium text-ink-gray">{t('groups.chatMode.label')}</span>
                            <ChatRolesSelect
                                // A new group starts with admins and sub-admins posting; an existing one shows its setting.
                                defaultValue={group ? chatRolesFrom(group.meta?.chat_roles, group.meta?.chat_mode) : ['admin', 'sub_admin']}
                            />
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
