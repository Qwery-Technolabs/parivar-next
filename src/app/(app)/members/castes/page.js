import PageHeader from '@/components/shell/page-header';
import CasteManager from '@/components/settings/caste-manager';
import { requireRole } from '@/lib/auth';
import { listCastes } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('castes.title') };
}

export default async function CastesPage() {
    await requireRole('administrator');
    const { t } = await getT();
    // Castes are managed from the Members page (its top-right button), so back goes there.
    const back = { href: '/members', label: t('members.title') };
    const castes = await listCastes();
    return (
        <div>
            <PageHeader
                title={t('castes.title')}
                subtitle={t('castes.subtitle')}
                back={back}
            />
            <CasteManager castes={castes} />
        </div>
    );
}
