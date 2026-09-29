import MemberForm from '@/components/members/member-form';
import PageHeader from '@/components/shell/page-header';
import { requireRole } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';
import { listCities, listVillages } from '@/lib/members';
import { assignableRoles } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.add') };
}

export default async function NewMemberPage() {
    const user = await requireRole('sub_admin');
    const { t, locale } = await getT();
    const [villages, cities, castes] = await Promise.all([listVillages(), listCities(), casteOptions(locale)]);
    return (
        <div>
            <PageHeader title={t('members.add')} back={{ href: '/members', label: t('members.title') }} />
            <MemberForm
                roles={assignableRoles(user.role)}
                villages={villages.map((v) => v.value)}
                cities={cities.map((c) => c.value)}
                casteOptions={castes}
            />
        </div>
    );
}
