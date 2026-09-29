'use client';
import { Megaphone, Phone, Shield, ShieldCheck, UserMinus, UserPlus, UserRound, UserRoundSearch } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addGroupMember, inviteGroupMember, removeGroupMember, setGroupMemberRole } from '@/app/actions/groups';
import Badge from '@/components/ui/badge';
import BilingualName from '@/components/ui/bilingual-name';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { canActOnRole, canManageMembership, GROUP_ROLES } from '@/lib/group-roles';
import { useT } from '@/lib/i18n/client';
import { formatPhone } from '@/lib/phone';

// Badge + menu icon per group role.
const ROLE_UI = {
    admin: { tone: 'orange', Icon: ShieldCheck },
    sub_admin: { tone: 'blue', Icon: Shield },
    speaker: { tone: 'green', Icon: Megaphone },
    member: { tone: 'gray', Icon: UserRound },
};

/**
 * @param {{ groupId: number, members: any[], standing: 'app'|'admin'|'sub_admin'|null, currentUserId: number, creatorId?: number|null }} props
 */
export default function GroupMembers({ groupId, members, standing, currentUserId, creatorId = null }) {
    const { t, locale } = useT();
    const canManage = canManageMembership(standing);
    // Roles this actor may hand out when adding someone.
    const grantable = GROUP_ROLES.filter((r) => canActOnRole(standing, null, r));
    const [pending, startTransition] = useTransition();

    const run = (fn) =>
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });

    return (
        <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">
                    {t('groups.members')} <span className="font-normal text-ink-gray tabular-nums">({members.length})</span>
                </h2>
                {canManage && (
                    <FormDialog
                        title={t('groups.addMember')}
                        // One dialog, two ways in: pick a registered member, or type a mobile number.
                        action={(prev, fd) => (fd.get('mode') === 'phone' ? inviteGroupMember(prev, fd) : addGroupMember(prev, fd))}
                        hidden={{ group_id: groupId }}
                        submitIcon={UserPlus}
                        width="sm:max-w-md"
                        trigger={({ open }) => (
                            <button
                                type="button"
                                onClick={open}
                                className="inline-flex h-9 shrink-0 items-center gap-2 btn-secondary rounded-md px-3 text-sm font-medium"
                            >
                                <UserPlus className="size-4" /> {t('groups.addMember')}
                            </button>
                        )}
                    >
                        {({ fieldError }) => (
                            <>
                                <AddMemberFields fieldError={fieldError} exclude={members.map((m) => m.id)} />
                                <Field label={t('members.role')}>
                                    <select name="member_role" defaultValue="member" className={`${selectInput()} w-full`}>
                                        {grantable.map((r) => (
                                            <option key={r} value={r}>
                                                {t(`groups.roles.${r}`)}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </>
                        )}
                    </FormDialog>
                )}
            </div>
            <div className={pending ? 'cursor-wait opacity-70' : ''}>
                <TableShell>
                    <THead>
                        <Th>{t('members.fullName')}</Th>
                        <Th className="hidden sm:table-cell">{t('members.phone')}</Th>
                        <Th>{t('members.role')}</Th>
                        {canManage && (
                            <Th className="w-12">
                                <span className="sr-only">{t('common.actions')}</span>
                            </Th>
                        )}
                    </THead>
                    <tbody>
                        {members.length === 0 && <EmptyRow colSpan={4}>{t('groups.noMembers')}</EmptyRow>}
                        {members.map((m) => (
                            <Tr key={m.id}>
                                <Td className="max-w-64">
                                    <Link href={`/members/${m.id}`} className="font-medium text-primary hover:underline">
                                        {(locale === 'gu' && m.full_name_local) || m.full_name}
                                    </Link>
                                    {/* Only a tag: once another admin demotes the creator, they are a member like any other. */}
                                    {m.id === creatorId && (
                                        <Badge tone="gray" className="ml-1.5">
                                            {t('common.creator')}
                                        </Badge>
                                    )}
                                    {/* Added by phone and has never signed in. */}
                                    {!m.last_login_at && (
                                        <Badge tone="gray" className="ml-1.5">
                                            {t('groups.invite.notJoined')}
                                        </Badge>
                                    )}
                                    {m.village && <span className="block text-xs text-ink-gray">{m.village}</span>}
                                </Td>
                                <Td className="hidden whitespace-nowrap tabular-nums sm:table-cell">{formatPhone(m.phone)}</Td>
                                <Td>
                                    {(() => {
                                        const ui = ROLE_UI[m.member_role] ?? ROLE_UI.member;
                                        return (
                                            <Badge tone={ui.tone}>
                                                <ui.Icon className="size-3" /> {t(`groups.roles.${m.member_role}`)}
                                            </Badge>
                                        );
                                    })()}
                                </Td>
                                {canManage && (
                                    <Td className="text-right">
                                        {/* A sub-admin sees no menu on admins and sub-admins: they cannot act on them. */}
                                        {m.id !== currentUserId && canActOnRole(standing, m.member_role) && (
                                            <KebabMenu label={t('common.more')}>
                                                {(close) => (
                                                    <>
                                                        {GROUP_ROLES.filter((r) => r !== m.member_role && canActOnRole(standing, m.member_role, r)).map((r) => {
                                                            const RoleIcon = ROLE_UI[r].Icon;
                                                            return (
                                                                <MenuItem
                                                                    key={r}
                                                                    icon={RoleIcon}
                                                                    onClick={() => {
                                                                        close();
                                                                        run(() => setGroupMemberRole(groupId, m.id, r));
                                                                    }}
                                                                >
                                                                    {t(`groups.makeRole.${r}`)}
                                                                </MenuItem>
                                                            );
                                                        })}
                                                        <MenuSeparator />
                                                        <MenuItem
                                                            icon={UserMinus}
                                                            danger
                                                            onClick={() => {
                                                                close();
                                                                if (window.confirm(`${t('groups.removeMember')}?`)) run(() => removeGroupMember(groupId, m.id));
                                                            }}
                                                        >
                                                            {t('groups.removeMember')}
                                                        </MenuItem>
                                                    </>
                                                )}
                                            </KebabMenu>
                                        )}
                                    </Td>
                                )}
                            </Tr>
                        ))}
                    </tbody>
                </TableShell>
            </div>
        </section>
    );
}

/** Existing member (search) or By phone number (name + mobile), for the Add dialog. */
function AddMemberFields({ fieldError, exclude }) {
    const { t } = useT();
    const [mode, setMode] = useState('member');
    const modes = [
        { key: 'member', label: t('groups.invite.existing'), Icon: UserRoundSearch },
        { key: 'phone', label: t('groups.invite.byPhone'), Icon: Phone },
    ];
    return (
        <>
            <input type="hidden" name="mode" value={mode} />
            <div role="tablist" className="grid grid-cols-2 rounded-md border border-surface-border p-0.5">
                {modes.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={mode === key}
                        onClick={() => setMode(key)}
                        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded text-xs font-medium ${mode === key ? 'seg-active' : 'text-ink-gray hover:text-primary'}`}
                    >
                        <Icon className="size-3.5" /> {label}
                    </button>
                ))}
            </div>
            {mode === 'member' ? (
                <Field label={t('relations.person')} error={fieldError('user_id')} required>
                    <MemberPicker name="user_id" exclude={exclude} hasError={!!fieldError('user_id')} />
                </Field>
            ) : (
                <>
                    <Field label={t('members.phone')} hint={t('groups.invite.phoneHint')} error={fieldError('phone')} required>
                        <input name="phone" type="tel" inputMode="numeric" required className={`${textInput(!!fieldError('phone'))} w-full tabular-nums`} />
                    </Field>
                    <BilingualName
                        enLabel={t('members.fullName')}
                        guLabel={t('members.fullNameLocal')}
                        enName="full_name"
                        guName="full_name_local"
                        error={fieldError('full_name')}
                    />
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('groups.invite.passwordNote')}</p>
                </>
            )}
        </>
    );
}
