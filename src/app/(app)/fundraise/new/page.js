import { redirect } from 'next/navigation';
import CampaignForm from '@/components/fundraise/campaign-form';
import PageHeader, { Card } from '@/components/shell/page-header';
import { adminGroupIds, canCreateFundraiseIn } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { audienceSuggestions, knownLocations, listGroupsForSelect } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageAllFundraises } from '@/lib/roles';
import { getSettings } from '@/lib/settings';
import { sp1 } from '@/lib/url';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('fundraise.add') };
}

/** A fundraise is always started from its group: /fundraise/new?group=<id>. */
export default async function NewFundraisePage({ searchParams }) {
    const sp = await searchParams;
    const user = await requireUser();
    const groupId = Number.parseInt(sp1(sp.group), 10);
    if (!Number.isInteger(groupId) || groupId <= 0 || !(await canCreateFundraiseIn(user, groupId))) redirect('/groups');

    const { t, locale } = await getT();
    const all = canManageAllFundraises(user.role);
    const [groups, mine, locations, settings, castes, suggestions] = await Promise.all([
        listGroupsForSelect(),
        all ? [] : adminGroupIds(user.id),
        knownLocations(),
        getSettings('fundraise'),
        casteOptions(locale),
        audienceSuggestions(),
    ]);
    // The group select still lets the creator switch to another group they may create in.
    const allowed = all ? groups : groups.filter((g) => mine.includes(g.id));
    const group = groups.find((g) => g.id === groupId);
    if (!group) redirect('/groups'); // archived group

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={t('fundraise.add')}
                subtitle={localized(group, 'name', locale)}
                back={{ href: `/groups/${groupId}`, label: localized(group, 'name', locale) }}
            />
            <Card>
                <CampaignForm
                    groups={allowed}
                    defaultGroupId={groupId}
                    cancelHref={`/groups/${groupId}`}
                    locations={locations}
                    defaultPublic={settings.default_public}
                    castes={castes}
                    suggestions={suggestions}
                />
            </Card>
        </div>
    );
}
