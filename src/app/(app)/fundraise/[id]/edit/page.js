import { notFound, redirect } from 'next/navigation';
import CampaignForm from '@/components/fundraise/campaign-form';
import DeleteCampaignButton from '@/components/fundraise/delete-campaign-button';
import PageHeader, { Card } from '@/components/shell/page-header';
import { adminGroupIds, canManageFundraise } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getCampaign, knownLocations, listGroupsForSelect } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageAllFundraises } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('fundraise.edit') };
}

export default async function EditFundraisePage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const campaign = await getCampaign(Number(id));
    if (!campaign) notFound();
    if (!(await canManageFundraise(user, campaign))) redirect(`/fundraise/${campaign.id}`);

    const { t, locale } = await getT();
    const all = canManageAllFundraises(user.role);
    const [groups, mine, locations] = await Promise.all([listGroupsForSelect(), all ? [] : adminGroupIds(user.id), knownLocations()]);
    // Keep the current group selectable even if it was archived since.
    const allowed = all ? groups : groups.filter((g) => mine.includes(g.id) || g.id === campaign.group_id);

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={t('fundraise.edit')}
                subtitle={localized(campaign, 'title', locale)}
                back={{ href: `/fundraise/${campaign.id}`, label: localized(campaign, 'title', locale) }}
            />
            <div className="max-w-3xl space-y-4">
                <Card>
                    <CampaignForm
                        campaign={campaign}
                        groups={allowed}
                        allowNoGroup={all || !campaign.group_id}
                        cancelHref={`/fundraise/${campaign.id}`}
                        locations={locations}
                    />
                </Card>
                {all && (
                    <div className="flex justify-end">
                        <DeleteCampaignButton campaignId={campaign.id} />
                    </div>
                )}
            </div>
        </div>
    );
}
