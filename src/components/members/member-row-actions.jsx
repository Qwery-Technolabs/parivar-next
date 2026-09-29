'use client';
import { Eye, GitFork, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { assignToGroup } from '@/app/actions/members';
import { Field, selectInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

export default function MemberRowActions({ member, canEdit, groups, canAssignGroups }) {
    const { t } = useT();
    const [memberRole, setMemberRole] = useState('admin');

    return (
        <FormDialog
            title={memberRole === 'admin' ? t('members.makeGroupAdmin') : t('members.addToGroup')}
            description={member.name}
            action={assignToGroup}
            hidden={{ user_id: member.id, member_role: memberRole }}
            submitIcon={memberRole === 'admin' ? ShieldCheck : UserPlus}
            submitLabel={memberRole === 'admin' ? t('members.makeGroupAdmin') : t('members.addToGroup')}
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
                                        icon={ShieldCheck}
                                        onClick={() => {
                                            close();
                                            setMemberRole('admin');
                                            open();
                                        }}
                                    >
                                        {t('members.makeGroupAdmin')}
                                    </MenuItem>
                                    <MenuItem
                                        icon={UserPlus}
                                        onClick={() => {
                                            close();
                                            setMemberRole('member');
                                            open();
                                        }}
                                    >
                                        {t('members.addToGroup')}
                                    </MenuItem>
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
