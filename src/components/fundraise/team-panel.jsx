'use client';
import { ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { removeTeamMember, saveTeamMember } from '@/app/actions/fundraise';
import Badge from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import FormDialog, { OpenOnMount } from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

// Rank order (access.js FUNDRAISE_TEAM_ROLES). A person can hold several.
const ROLES = ['admin', 'organizer', 'treasurer', 'collector', 'expenser', 'volunteer'];
const TONE = { admin: 'navy', organizer: 'orange', treasurer: 'green', collector: 'blue', expenser: 'purple', volunteer: 'gray' };

/**
 * The fundraise's team (About tab): each person with every role they hold. Managers add people and
 * change roles with tick boxes (Admin + Treasurer, Treasurer + Collector + Expenser …) and remove them.
 * Treasurer / Collector record contributions, Expenser records expenses; each entry's History shows who.
 */
export default function TeamPanel({ campaignId, team, canManage, creatorId = null }) {
    const { t, locale } = useT();
    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                {team.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink-gray">{t('fundraise.noTeam')}</p>
                ) : (
                    <ul className="divide-y divide-surface-border">
                        {team.map((m) => (
                            <TeamRow key={m.user_id} campaignId={campaignId} m={m} canManage={canManage} locale={locale} creatorId={creatorId} />
                        ))}
                    </ul>
                )}
            </div>
            <ul className="grid gap-1 text-xs text-ink-gray sm:grid-cols-2">
                {ROLES.map((r) => (
                    <li key={r}>
                        <span className="font-medium text-primary">{t(`fundraise.teamRoles.${r}`)}</span> — {t(`fundraise.teamRoleHints.${r}`)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Tick boxes for the roles (posted as member_roles[]). */
function RoleChecks({ initial, error }) {
    const { t } = useT();
    const [picked, setPicked] = useState(() => new Set(initial));
    return (
        <Field label={t('fundraise.teamRolesLabel')} hint={t('fundraise.teamRolesHint')} error={error} required>
            <div className="grid gap-1.5 sm:grid-cols-2">
                {ROLES.map((r) => (
                    <label key={r} className="flex cursor-pointer items-start gap-2 rounded-md border border-surface-border px-2.5 py-2 text-sm hover:bg-accent/50">
                        <input
                            type="checkbox"
                            name="member_roles"
                            value={r}
                            checked={picked.has(r)}
                            onChange={() =>
                                setPicked((s) => {
                                    const n = new Set(s);
                                    if (n.has(r)) n.delete(r);
                                    else n.add(r);
                                    return n;
                                })
                            }
                            className="mt-0.5 size-4 shrink-0 accent-brand-orange-strong"
                        />
                        <span className="min-w-0">
                            <span className="block font-medium text-primary">{t(`fundraise.teamRoles.${r}`)}</span>
                            <span className="block text-xs text-ink-gray">{t(`fundraise.teamRoleHints.${r}`)}</span>
                        </span>
                    </label>
                ))}
            </div>
        </Field>
    );
}

function TeamRow({ campaignId, m, canManage, locale, creatorId }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const [editKey, setEditKey] = useState(0);
    const name = (locale === 'gu' && m.full_name_local) || m.full_name;
    const roles = m.roles?.length ? m.roles : [m.member_role];

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
                <Link href={`/members/${m.user_id}`} className="font-medium text-primary hover:underline break-words">
                    {name}
                </Link>
                {/* Only a tag: the creator's rights are whatever roles they hold now. */}
                {m.user_id === creatorId && (
                    <Badge tone="gray" className="ml-1.5">
                        {t('common.creator')}
                    </Badge>
                )}
                {m.village && <p className="text-xs text-ink-gray">{m.village}</p>}
                <div className="mt-1 flex flex-wrap gap-1">
                    {roles.map((r) => (
                        <Badge key={r} tone={TONE[r]}>
                            {t(`fundraise.teamRoles.${r}`)}
                        </Badge>
                    ))}
                </div>
            </div>
            {canManage && (
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
                                {t('fundraise.editRoles')}
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                                icon={UserMinus}
                                danger
                                onClick={() => {
                                    close();
                                    if (window.confirm(t('fundraise.removeFromTeamConfirm', { name }))) run(() => removeTeamMember(campaignId, m.user_id));
                                }}
                            >
                                {t('fundraise.removeFromTeam')}
                            </MenuItem>
                        </>
                    )}
                </KebabMenu>
            )}
            {canManage && editKey > 0 && (
                <FormDialog
                    key={editKey}
                    title={t('fundraise.editRoles')}
                    description={name}
                    action={saveTeamMember}
                    hidden={{ campaign_id: campaignId, user_id: m.user_id }}
                    submitIcon={ShieldCheck}
                    width="sm:max-w-lg"
                    trigger={({ open }) => <OpenOnMount open={open} />}
                >
                    {({ fieldError }) => <RoleChecks initial={roles} error={fieldError('member_roles')} />}
                </FormDialog>
            )}
        </li>
    );
}

/** "Add to team" — sits in the Team card's header (details-tab.jsx). Pick a member, tick their roles. */
export function AddTeamMemberButton({ campaignId, exclude }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('fundraise.addTeamMember')}
            action={saveTeamMember}
            hidden={{ campaign_id: campaignId }}
            submitIcon={UserPlus}
            submitLabel={t('common.add')}
            width="sm:max-w-lg"
            trigger={({ open }) => (
                <button type="button" onClick={open} className="btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium">
                    <UserPlus className="size-3.5" /> {t('fundraise.addTeamMember')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('members.fullName')} error={fieldError('user_id')} required>
                        <MemberPicker name="user_id" exclude={exclude} hasError={!!fieldError('user_id')} />
                    </Field>
                    <RoleChecks initial={['collector']} error={fieldError('member_roles')} />
                </>
            )}
        </FormDialog>
    );
}
