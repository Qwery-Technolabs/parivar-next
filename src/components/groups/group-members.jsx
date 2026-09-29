'use client';
import { Check, ChevronLeft, ChevronRight, Megaphone, Phone, Shield, ShieldCheck, UserCog, UserMinus, UserPlus, UserRound, UserRoundSearch } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addGroupMember, inviteGroupMember, removeGroupMember, setGroupMemberRole } from '@/app/actions/groups';
import Badge from '@/components/ui/badge';
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
                                </Td>
                                {canManage && (
                                    <Td className="text-right">
                                        {/* A sub-admin sees no menu on admins and sub-admins: they cannot act on them. */}
                                        {m.id !== currentUserId && canActOnRole(standing, m.member_role) && (
                                            <KebabMenu label={t('common.more')}>
                                                {(close) => (
                                                    <MemberMenu
                                                        member={m}
                                                        standing={standing}
                                                        close={close}
                                                        onRole={(r) => run(() => setGroupMemberRole(groupId, m.id, r))}
                                                        onRemove={() => {
                                                            if (!window.confirm(`${t('groups.removeMember')}?`)) return;
                                                            // Never signed in: offer to drop the unused account too (the server
                                                            // only does it if they were invited and are in no other group).
                                                            const alsoDelete = !m.last_login_at && window.confirm(t('groups.invite.deleteToo'));
                                                            run(() => removeGroupMember(groupId, m.id, alsoDelete));
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
                    <Field label={t('groups.invite.nameOptional')}>
                        <input name="full_name" maxLength={150} autoComplete="off" className={`${textInput()} w-full`} />
                    </Field>
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('groups.invite.passwordNote')}</p>
                </>
            )}
        </>
    );
}

/**
 * Row menu for one member: "Change role ›" opens the roles in place (with ‹ Back) — a
 * side flyout would be clipped by the scrolling menu panel. Only roles the actor may give
 * are listed; the current one is ticked.
 */
function MemberMenu({ member, standing, close, onRole, onRemove }) {
    const { t } = useT();
    const [view, setView] = useState('main');
    const choices = GROUP_ROLES.filter((r) => r === member.member_role || canActOnRole(standing, member.member_role, r));

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
            {choices.length > 1 && <MenuSeparator />}
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
        </>
    );
}
