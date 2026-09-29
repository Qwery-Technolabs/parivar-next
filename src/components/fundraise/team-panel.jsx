'use client';
import { UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { removeTeamMember, saveTeamMember } from '@/app/actions/fundraise';
import Badge from '@/components/ui/badge';
import { Field, selectInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import { KebabMenu, MenuItem } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

const ROLES = ['organizer', 'treasurer', 'collector', 'volunteer'];
const TONE = { organizer: 'orange', treasurer: 'green', collector: 'blue', volunteer: 'gray' };

export default function TeamPanel({ campaignId, team, canManage }) {
    const { t, locale } = useT();
    return (
        <div className="space-y-3">
            {canManage && (
                <div className="flex justify-end">
                    <AddMemberDialog campaignId={campaignId} exclude={team.map((m) => m.user_id)} />
                </div>
            )}
            <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                {team.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink-gray">{t('fundraise.noTeam')}</p>
                ) : (
                    <ul className="divide-y divide-surface-border">
                        {team.map((m) => (
                            <TeamRow key={m.user_id} campaignId={campaignId} m={m} canManage={canManage} locale={locale} />
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

function TeamRow({ campaignId, m, canManage, locale }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const name = (locale === 'gu' && m.full_name_gu) || m.full_name;

    function run(fn) {
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    // Live control: one change is one intent (DESIGN.md §6), so the role select saves on change.
    function changeRole(e) {
        const fd = new FormData();
        fd.set('campaign_id', String(campaignId));
        fd.set('user_id', String(m.user_id));
        fd.set('member_role', e.target.value);
        run(() => saveTeamMember(null, fd));
    }

    return (
        <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${pending ? 'cursor-wait opacity-70' : ''}`}>
            <div className="min-w-0 flex-1">
                <Link href={`/members/${m.user_id}`} className="font-medium text-primary hover:underline break-words">
                    {name}
                </Link>
                {m.village && <p className="text-xs text-ink-gray">{m.village}</p>}
            </div>
            {canManage ? (
                <select
                    value={m.member_role}
                    onChange={changeRole}
                    disabled={pending}
                    aria-label={t('fundraise.changeRole')}
                    className={`${selectInput(false, 'h-8')} text-xs`}
                >
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {t(`fundraise.teamRoles.${r}`)}
                        </option>
                    ))}
                </select>
            ) : (
                <Badge tone={TONE[m.member_role]}>{t(`fundraise.teamRoles.${m.member_role}`)}</Badge>
            )}
            {canManage && (
                <KebabMenu label={t('common.more')}>
                    {(close) => (
                        <MenuItem
                            icon={UserMinus}
                            danger
                            onClick={() => {
                                close();
                                if (window.confirm(t('fundraise.removeFromTeamConfirm', { name })))
                                    run(() => removeTeamMember(campaignId, m.user_id));
                            }}
                        >
                            {t('fundraise.removeFromTeam')}
                        </MenuItem>
                    )}
                </KebabMenu>
            )}
        </li>
    );
}

function AddMemberDialog({ campaignId, exclude }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('fundraise.addTeamMember')}
            action={saveTeamMember}
            hidden={{ campaign_id: campaignId }}
            submitIcon={UserPlus}
            submitLabel={t('common.add')}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                    <UserPlus className="size-4" /> {t('fundraise.addTeamMember')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('members.fullName')} error={fieldError('user_id')} required>
                        <MemberPicker name="user_id" exclude={exclude} hasError={!!fieldError('user_id')} />
                    </Field>
                    <Field label={t('fundraise.teamRole')} error={fieldError('member_role')} required>
                        <select name="member_role" defaultValue="collector" className={`${selectInput(!!fieldError('member_role'))} w-full`}>
                            {ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {t(`fundraise.teamRoles.${r}`)} — {t(`fundraise.teamRoleHints.${r}`)}
                                </option>
                            ))}
                        </select>
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
