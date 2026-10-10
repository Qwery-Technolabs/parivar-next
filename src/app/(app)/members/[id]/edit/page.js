import { notFound, redirect } from 'next/navigation';
import MemberEditTabs from '@/components/members/member-edit-tabs';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { localized } from '@/lib/i18n/config';
import { casteOptions } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';
import { getMember, listCities, listVillages } from '@/lib/members';
import { assignableRoles, canEditUser, canManageMembers, canResetPassword } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.edit') };
}

export default async function EditMemberPage({ params, searchParams }) {
    const { id } = await params;
    const { tab, welcome } = await searchParams;
    const user = await requireUser();
    const member = await getMember(Number(id) || 0);
    if (!member) notFound();
    const canEdit = canEditUser(user, member);
    const canReset = canResetPassword(user, member);
    if (!canEdit && !canReset) redirect(`/members/${member.id}`);
    const { t, locale } = await getT();
    const [villages, cities, castes] = await Promise.all([listVillages(), listCities(), casteOptions(locale)]);
    const self = user.id === member.id;
    return (
        <div>
            <PageHeader
                title={t('members.edit')}
                subtitle={localized(member, 'full_name', locale)}
                back={{ href: `/members/${member.id}`, label: localized(member, 'full_name', locale) }}
            />
            {/* Just set their own password after being invited: ask for the rest of their details. */}
            {welcome && self && (
                <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{t('members.welcomeFill')}</p>
            )}
            <MemberEditTabs
                // Invited without a name, the phone number stood in: show an empty (required) name to fill.
                member={member.full_name === member.phone ? { ...member, full_name: '' } : member}
                initialTab={typeof tab === 'string' ? tab : undefined}
                roles={assignableRoles(user.role)}
                // Password-only access (an admin resetting a peer) shows just that tab.
                canEdit={canEdit}
                // Role / status: member administrators only — never your own, and not whoever added a relative.
                canSetRole={canEdit && !self && canManageMembers(user.role)}
                canSetPassword={canReset}
                villages={villages.map((v) => v.value)}
                cities={cities.map((c) => c.value)}
                casteOptions={castes}
            />
        </div>
    );
}
