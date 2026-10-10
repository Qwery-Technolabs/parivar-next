'use client';
import { Check, ChevronLeft, ChevronRight, Megaphone, Shield, ShieldCheck, UserCog, UserMinus, UserPlus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addGroupMember, inviteGroupMember, removeGroupMember, setGroupMemberRole } from '@/app/actions/groups';
import Badge from '@/components/ui/badge';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import PersonOrPhone from '@/components/ui/person-or-phone';
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
 * Members with their main role and, as badges, their team roles (set in the About tab's Team card).
 * `team` = the VIEWER's team roles: the "members" one lets them add / edit / remove plain members and speakers.
 * @param {{ groupId: number, members: any[], standing: 'app'|'admin'|'sub_admin'|null, team?: string[], currentUserId: number, creatorId?: number|null }} props
 */
export default function GroupMembers({ groupId, members, standing, team = [], currentUserId, creatorId = null }) {
    const { t, locale } = useT();
    const canManage = canManageMembership(standing, team);
    // Roles this actor may hand out when adding someone.
    const grantable = GROUP_ROLES.filter((r) => canActOnRole(standing, null, r, team));
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
                                <PersonOrPhone fieldError={fieldError} pickerName="user_id" exclude={members.map((m) => m.id)} />
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
                                        <Badge tone="amber" className="ml-1.5">
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
                                    {/* Team roles (tasks given to a member / speaker). */}
                                    {m.team?.length > 0 && (
                                        <span className="mt-1 flex flex-wrap gap-1">
                                            {m.team.map((r) => (
                                                <Badge key={r} tone="navy">
                                                    {t(`groups.team.${r}`)}
                                                </Badge>
                                            ))}
                                        </span>
                                    )}
                                </Td>
                                {canManage && (
                                    <Td className="text-right">
                                        {/* A sub-admin sees no menu on admins and sub-admins: they cannot act on them. */}
                                        {m.id !== currentUserId && canActOnRole(standing, m.member_role, undefined, team) && (
                                            <KebabMenu label={t('common.more')}>
                                                {(close) => (
                                                    <MemberMenu
                                                        member={m}
                                                        standing={standing}
                                                        team={team}
                                                        close={close}
                                                        onRole={(r) => run(() => setGroupMemberRole(groupId, m.id, r))}
                                                        onRemove={() => {
                                                            if (!window.confirm(`${t('groups.removeMember')}?`)) return;
                                                            // Group membership only — the person stays in Members and Family.
                                                            run(() => removeGroupMember(groupId, m.id));
                                                        }}
                                                    />
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

/**
 * Row menu for one member: "Change role ›" opens the roles in place (with ‹ Back) — a
 * side flyout would be clipped by the scrolling menu panel. Only roles the actor may give
 * are listed; the current one is ticked.
 */
function MemberMenu({ member, standing, team, close, onRole, onRemove }) {
    const { t } = useT();
    const [view, setView] = useState('main');
    const choices = GROUP_ROLES.filter((r) => r === member.member_role || canActOnRole(standing, member.member_role, r, team));
    const canAct = canActOnRole(standing, member.member_role, undefined, team);

    if (view === 'roles') {
        return (
            <div role="group" aria-label={t('groups.changeRole')}>
                <button
                    type="button"
                    onClick={() => setView('main')}
                    className="flex w-full items-center gap-1.5 border-b border-surface-border px-3 py-2 text-left text-xs font-semibold text-ink-gray hover:bg-accent"
                >
                    <ChevronLeft className="size-4" /> {t('groups.changeRole')}
                </button>
                {choices.map((r) => {
                    const RoleIcon = ROLE_UI[r].Icon;
                    const current = r === member.member_role;
                    return (
                        <button
                            key={r}
                            type="button"
                            role="menuitemradio"
                            aria-checked={current}
                            disabled={current}
                            onClick={() => {
                                close();
                                onRole(r);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                        >
                            <RoleIcon className="size-4 text-ink-gray" />
                            <span className={`flex-1 ${current ? 'font-semibold' : ''}`}>{t(`groups.roles.${r}`)}</span>
                            {current && <Check className="size-4 text-brand-orange-strong" />}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <>
            {choices.length > 1 && (
                <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="menu"
                    onClick={() => setView('roles')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent"
                >
                    <UserCog className="size-4 text-ink-gray" />
                    <span className="flex-1">{t('groups.changeRole')}</span>
                    <ChevronRight className="size-4 text-ink-gray" />
                </button>
            )}
            {canAct && choices.length > 1 && <MenuSeparator />}
            {canAct && (
                <MenuItem
                    icon={UserMinus}
                    danger
                    onClick={() => {
                        close();
                        onRemove();
                    }}
                >
                    {t('groups.removeMember')}
                </MenuItem>
            )}
        </>
    );
}
