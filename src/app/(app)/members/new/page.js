import MemberForm from '@/components/members/member-form';
import PageHeader from '@/components/shell/page-header';
import { requireRole } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';
import { listVillages } from '@/lib/members';
import { assignableRoles } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.add') };
}

export default async function NewMemberPage() {
    const user = await requireRole('up_sarpanch');
    const { t, locale } = await getT();
    const [villages, castes] = await Promise.all([listVillages(), casteOptions(locale)]);
    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader title={t('members.add')} back={{ href: '/members', label: t('members.title') }} />
            <MemberForm
                roles={assignableRoles(user.role)}
                canSetRole
                canSetPassword
                villages={villages.map((v) => v.value)}
                casteOptions={castes}
            />
        </div>
    );
}
