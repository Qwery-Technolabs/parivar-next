import { notFound, redirect } from 'next/navigation';
import CampaignForm from '@/components/fundraise/campaign-form';
import DeleteCampaignButton from '@/components/fundraise/delete-campaign-button';
import PageHeader, { Card } from '@/components/shell/page-header';
import { adminGroupIds, canManageFundraise } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { audienceSuggestions, getAudience, getCampaign, knownLocations, listGroupsForSelect } from '@/lib/fundraise';
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
    const [groups, mine, locations, audience, castes, suggestions] = await Promise.all([
        listGroupsForSelect(),
        all ? [] : adminGroupIds(user.id),
        knownLocations(),
        getAudience(campaign.id),
        casteOptions(locale),
        audienceSuggestions(),
    ]);
    const allowed = all ? groups : groups.filter((g) => mine.includes(g.id) || g.id === campaign.group_id);
    // Keep the current group selectable even if it was archived since (the list holds active groups only).
    if (!allowed.some((g) => g.id === campaign.group_id))
        allowed.unshift({ id: campaign.group_id, name: campaign.group_name, name_local: campaign.group_name_local });
    // Groups it is (or may also be) shown in, besides the home group. Linked groups this user
    // cannot manage stay ticked and locked; the server keeps them.
    const linked = new Set((campaign.groups ?? []).map((g) => g.id));
    const manageable = new Set((all ? groups : groups.filter((g) => mine.includes(g.id))).map((g) => g.id));
    const otherGroups = [
        ...groups.filter((g) => g.id !== campaign.group_id && (manageable.has(g.id) || linked.has(g.id))),
        ...(campaign.groups ?? []).filter((g) => g.id !== campaign.group_id && !groups.some((x) => x.id === g.id)),
    ].map((g) => ({ ...g, linked: linked.has(g.id), locked: linked.has(g.id) && !manageable.has(g.id) }));
    const groupName = localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale);

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={t('fundraise.edit')}
                subtitle={localized(campaign, 'title', locale)}
                back={{ href: `/groups/${campaign.group_id}`, label: groupName }}
            />
            <div className="space-y-4">
                {/* The form draws its own card; Status sits above it. */}
                <CampaignForm
                    campaign={campaign}
                    groups={allowed}
                    otherGroups={otherGroups}
                    cancelHref={`/fundraise/${campaign.id}`}
                    locations={locations}
                    audience={audience.map((a) => ({ kind: a.kind, value: a.value }))}
                    castes={castes}
                    suggestions={suggestions}
                />
                {all && (
                    <div className="flex justify-end">
                        <DeleteCampaignButton campaignId={campaign.id} />
                    </div>
                )}
            </div>
        </div>
    );
}
