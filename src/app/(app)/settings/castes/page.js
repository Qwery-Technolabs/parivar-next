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
    const castes = await listCastes();
    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                title={t('castes.title')}
                subtitle={t('castes.subtitle')}
                back={{ href: '/settings', label: t('settings.title') }}
            />
            <CasteManager castes={castes} />
        </div>
    );
}
