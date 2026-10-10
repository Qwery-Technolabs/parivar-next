'use client';
import { ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { removeFromGroupTeam, saveGroupTeam } from '@/app/actions/groups';
import Badge from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import FormDialog, { OpenOnMount } from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { canActOnRole, canAdminister, GROUP_TEAM_ROLES, isGroupLeader, teamOf } from '@/lib/group-roles';
import { useT } from '@/lib/i18n/client';

const LEAD = ['admin', 'sub_admin'];
const ROLES = [...LEAD, ...GROUP_TEAM_ROLES];
const TONE = { admin: 'orange', sub_admin: 'blue', members: 'navy', fundraise: 'green', meetings: 'purple', details: 'gray', discussion: 'amber' };
const label = (t, r) => (LEAD.includes(r) ? t(`groups.roles.${r}`) : t(`groups.team.${r}`));
const hint = (t, r) => t(`groups.teamHints.${r}`);

/**
 * The group's Team (About tab), like a fundraise team: each person with every role they hold. Its leaders add
 * people and change roles with tick boxes — Admin / Sub-admin (admins only) or the tasks (Members, Fundraise,
 * Meetings, Group details, Discussion) — and take people off the team (they stay in the group).
 * @param {{ groupId: number, members: any[], standing: string|null, currentUserId: number, creatorId?: number|null }} props
 */
export default function GroupTeamPanel({ groupId, members, standing, currentUserId, creatorId = null }) {
    const { t, locale } = useT();
    const team = teamOf(members);
    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-surface-border bg-white">
                {team.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink-gray">{t('groups.noTeam')}</p>
                ) : (
                    <ul className="divide-y divide-surface-border">
                        {team.map((m) => (
                            <TeamRow
                                key={m.id}
                                groupId={groupId}
                                m={m}
                                standing={standing}
                                self={m.id === currentUserId}
                                locale={locale}
                                creatorId={creatorId}
                            />
                        ))}
                    </ul>
                )}
            </div>
            <ul className="grid gap-1 text-xs text-ink-gray sm:grid-cols-2">
                {ROLES.map((r) => (
                    <li key={r}>
                        <span className="font-medium text-primary">{label(t, r)}</span> — {hint(t, r)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Tick boxes (posted as roles[]): Admin / Sub-admin (one at most, admins only), then the tasks — which a lead role already covers. */
function RoleChecks({ initial, canLead, error }) {
    const { t } = useT();
    const [picked, setPicked] = useState(() => new Set(initial));
    const lead = picked.has('admin') || picked.has('sub_admin');
    const toggle = (r) =>
        setPicked((s) => {
            const n = new Set(s);
            if (n.has(r)) n.delete(r);
            else {
                n.add(r);
                // Admin and Sub-admin: one or the other.
                if (r === 'admin') n.delete('sub_admin');
                if (r === 'sub_admin') n.delete('admin');
            }
            return n;
        });
    return (
        <Field label={t('groups.teamRoles')} hint={lead ? t('groups.leadAllTasks') : t('groups.teamRolesHint')} error={error} required>
            <div className="grid gap-1.5 sm:grid-cols-2">
                {ROLES.map((r) => {
                    const isLead = LEAD.includes(r);
                    const disabled = isLead ? !canLead : lead;
                    return (
                        <label
                            key={r}
                            className={`flex items-start gap-2 rounded-md border border-surface-border px-2.5 py-2 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent/50'}`}
                        >
                            <input
                                type="checkbox"
                                name="roles"
                                value={r}
                                checked={isLead ? picked.has(r) : lead || picked.has(r)}
                                disabled={disabled}
                                onChange={() => toggle(r)}
                                className="mt-0.5 size-4 shrink-0 accent-brand-orange-strong"
                            />
                            <span className="min-w-0">
                                <span className="block font-medium text-primary">{label(t, r)}</span>
                                <span className="block text-xs text-ink-gray">{hint(t, r)}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </Field>
    );
}

function TeamRow({ groupId, m, standing, self, locale, creatorId }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const [editKey, setEditKey] = useState(0);
    const name = (locale === 'gu' && m.full_name_local) || m.full_name;
    const roles = LEAD.includes(m.member_role) ? [m.member_role] : (m.team ?? []);
    // Leaders edit the team; an admin / sub-admin row only by those who may change that role (admins).
    const canEdit = isGroupLeader(standing) && !self && (!LEAD.includes(m.member_role) || canActOnRole(standing, m.member_role, 'member'));

    function run(fn) {
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    return (
        <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${pending ? 'cursor-wait opacity-70' : ''}`}>
            <div className="min-w-0 flex-1">
                <Link href={`/members/${m.id}`} className="font-medium text-primary hover:underline break-words">
                    {name}
                </Link>
                {m.id === creatorId && (
                    <Badge tone="gray" className="ml-1.5">
                        {t('common.creator')}
                    </Badge>
                )}
                {m.village && <p className="text-xs text-ink-gray">{m.village}</p>}
                <div className="mt-1 flex flex-wrap gap-1">
                    {roles.map((r) => (
                        <Badge key={r} tone={TONE[r]}>
                            {label(t, r)}
                        </Badge>
                    ))}
                </div>
            </div>
            {canEdit && (
                <KebabMenu label={t('common.more')}>
                    {(close) => (
                        <>
                            <MenuItem
                                icon={ShieldCheck}
                                onClick={() => {
                                    close();
                                    setEditKey((k) => k + 1);
                                }}
                            >
                                {t('groups.editRoles')}
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                                icon={UserMinus}
                                danger
                                onClick={() => {
                                    close();
                                    if (window.confirm(t('groups.removeFromTeamConfirm', { name }))) run(() => removeFromGroupTeam(groupId, m.id));
                                }}
                            >
                                {t('groups.removeFromTeam')}
                            </MenuItem>
                        </>
                    )}
                </KebabMenu>
            )}
            {canEdit && editKey > 0 && (
                <FormDialog
                    key={editKey}
                    title={t('groups.editRoles')}
                    description={name}
                    action={saveGroupTeam}
                    hidden={{ group_id: groupId, user_id: m.id }}
                    submitIcon={ShieldCheck}
                    width="sm:max-w-lg"
                    trigger={({ open }) => <OpenOnMount open={open} />}
                >
                    {({ fieldError }) => <RoleChecks initial={roles} canLead={canAdminister(standing)} error={fieldError('roles')} />}
                </FormDialog>
            )}
        </li>
    );
}

/** "Add to team" — in the Team card's header. Pick a member (not on the team yet), tick their roles. */
export function AddGroupTeamButton({ groupId, standing, exclude }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('groups.addTeamMember')}
            action={saveGroupTeam}
            hidden={{ group_id: groupId }}
            submitIcon={UserPlus}
            submitLabel={t('common.add')}
            width="sm:max-w-lg"
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className="btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium"
                >
                    <UserPlus className="size-3.5" /> {t('groups.addTeamMember')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('members.fullName')} error={fieldError('user_id')} required>
                        <MemberPicker name="user_id" exclude={exclude} hasError={!!fieldError('user_id')} />
                    </Field>
                    <RoleChecks initial={[]} canLead={canAdminister(standing)} error={fieldError('roles')} />
                </>
            )}
        </FormDialog>
    );
}
