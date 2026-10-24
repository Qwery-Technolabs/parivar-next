'use client';
import { Archive, ArchiveRestore, Eye, GitFork, History, Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMember, setMemberArchived } from '@/app/actions/members';
import MemberActivityDialog from '@/components/members/member-activity-dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/**
 * Members list, a row's ⋮: View · Edit · Family tree · Activity history (sub-admins and up — sign-ins and changes)
 * · Archive / Restore / Delete. Adding to a group is the bulk action (tick rows), not here.
 */
export default function MemberRowActions({ member, canEdit, canSeeActivity = false, canDelete = false }) {
    const { t } = useT();
    const [deleting, startDelete] = useTransition();
    const [activity, setActivity] = useState(false);
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
        <>
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
                        {canSeeActivity && (
                            <>
                                <MenuSeparator />
                                <MenuItem
                                    icon={History}
                                    onClick={() => {
                                        close();
                                        setActivity(true);
                                    }}
                                >
                                    {t('activity.title')}
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
            {canSeeActivity && <MemberActivityDialog member={member} open={activity} onOpenChange={setActivity} />}
        </>
    );
}
