import { notFound, redirect } from 'next/navigation';
import MemberForm from '@/components/members/member-form';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { localized } from '@/lib/i18n/config';
import { casteOptions } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';
import { getMember, listCities, listVillages } from '@/lib/members';
import { assignableRoles, canEditUser } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.edit') };
}

export default async function EditMemberPage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const member = await getMember(Number(id) || 0);
    if (!member) notFound();
    if (!canEditUser(user, member)) redirect(`/members/${member.id}`);
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
            <MemberForm
                member={member}
                roles={assignableRoles(user.role)}
                // Nobody changes their own role or status — that is someone else's decision.
                canSetRole={!self}
                // Own password is changed from the profile page, which asks for the current one.
                canSetPassword={!self}
                villages={villages.map((v) => v.value)}
                cities={cities.map((c) => c.value)}
                casteOptions={castes}
            />
        </div>
    );
}
