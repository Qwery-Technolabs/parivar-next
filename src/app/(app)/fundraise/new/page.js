import { redirect } from 'next/navigation';
import CampaignForm from '@/components/fundraise/campaign-form';
import PageHeader, { Card } from '@/components/shell/page-header';
import { adminGroupIds } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { knownLocations, listGroupsForSelect } from '@/lib/fundraise';
import { getT } from '@/lib/i18n/server';
import { canManageAllFundraises } from '@/lib/roles';
import { getSettings } from '@/lib/settings';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('fundraise.add') };
}

export default async function NewFundraisePage() {
    const user = await requireUser();
    const { t } = await getT();
    const all = canManageAllFundraises(user.role);
    const [groups, mine, locations, settings] = await Promise.all([
        listGroupsForSelect(),
        all ? [] : adminGroupIds(user.id),
        knownLocations(),
        getSettings('fundraise'),
    ]);
    // Group admins may only start a fundraise inside a group they administer.
    const allowed = all ? groups : groups.filter((g) => mine.includes(g.id));
    if (!all && allowed.length === 0) redirect('/fundraise');

    return (
        <div className="theme-fundraise">
            <PageHeader title={t('fundraise.add')} back={{ href: '/fundraise', label: t('fundraise.title') }} />
            <Card className="max-w-3xl">
                <CampaignForm
                    groups={allowed}
                    allowNoGroup={all}
                    cancelHref="/fundraise"
                    locations={locations}
                    defaultPublic={settings.default_public}
                />
            </Card>
        </div>
    );
}
