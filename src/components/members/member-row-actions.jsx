'use client';
import { Archive, ArchiveRestore, Eye, GitFork, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { assignToGroup, deleteMember, setMemberArchived } from '@/app/actions/members';
import { Field, selectInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

export default function MemberRowActions({ member, canEdit, groups, canAssignGroups, canDelete = false }) {
    const { t } = useT();
    const [deleting, startDelete] = useTransition();
    // Archive ⇄ restore (super admins / administrators): the step before Delete.
    const archive = (close, on) => {
        close();
        if (on && !window.confirm(t('members.archiveConfirm', { name: member.name }))) return;
        startDelete(async () => {
            const res = await setMemberArchived(member.id, on);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    };
    // Delete (super admins / administrators, archived members only): asks first, names the person, cannot be undone.
    const remove = (close) => {
        close();
        if (!window.confirm(t('members.deleteConfirm', { name: member.name }))) return;
        startDelete(async () => {
            const res = await deleteMember(member.id);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    };

    return (
        <FormDialog
            // Adds as a member only; making someone a group admin happens inside the group.
            title={t('members.addToGroup')}
            description={member.name}
            action={assignToGroup}
            hidden={{ user_id: member.id }}
            submitIcon={UserPlus}
            submitLabel={t('members.addToGroup')}
            width="sm:max-w-sm"
            trigger={({ open }) => (
                <KebabMenu label={t('common.more')}>
                    {(close) => (
                        <>
                            <MenuItem icon={Eye} href={`/members/${member.id}`}>
                                {t('common.view')}
                            </MenuItem>
                            {canEdit && (
                                <MenuItem icon={Pencil} href={`/members/${member.id}/edit`}>
                                    {t('common.edit')}
                                </MenuItem>
                            )}
                            <MenuItem icon={GitFork} href={`/members/${member.id}/tree`}>
                                {t('members.familyTree')}
                            </MenuItem>
                            {canAssignGroups && (
                                <>
                                    <MenuSeparator />
                                    <MenuItem
                                        icon={UserPlus}
                                        onClick={() => {
                                            close();
                                            open();
                                        }}
                                    >
                                        {t('members.addToGroup')}
                                    </MenuItem>
                                </>
                            )}
                            {/* Two steps: Archive first; only an archived member offers Restore and Delete. */}
                            {canDelete && (
                                <>
                                    <MenuSeparator />
                                    {member.archived ? (
                                        <>
                                            <MenuItem icon={ArchiveRestore} disabled={deleting} onClick={() => archive(close, false)}>
                                                {t('members.restore')}
                                            </MenuItem>
                                            <MenuItem icon={Trash2} danger disabled={deleting} onClick={() => remove(close)}>
                                                {t('members.delete')}
                                            </MenuItem>
                                        </>
                                    ) : (
                                        <MenuItem icon={Archive} disabled={deleting} onClick={() => archive(close, true)}>
                                            {t('members.archive')}
                                        </MenuItem>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </KebabMenu>
            )}
        >
            {({ fieldError }) =>
                groups.length === 0 ? (
                    <p className="text-sm text-ink-gray">{t('members.noGroups')}</p>
                ) : (
                    <Field label={t('members.chooseGroup')} error={fieldError('group_id')} required>
                        <select name="group_id" defaultValue="" required className={`${selectInput(!!fieldError('group_id'))} w-full`}>
                            <option value="" disabled>
                                {t('members.chooseGroup')}
                            </option>
                            {groups.map((g) => (
                                <option key={g.value} value={g.value}>
                                    {g.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                )
            }
        </FormDialog>
    );
}
