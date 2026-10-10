import { redirect } from 'next/navigation';
import CampaignForm from '@/components/fundraise/campaign-form';
import StatusSelect from '@/components/fundraise/status-select';
import PageHeader from '@/components/shell/page-header';
import { createFundraiseGroupIds, canCreateFundraiseIn } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { audienceSuggestions, knownLocations, listGroupsForSelect } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageAllFundraises } from '@/lib/roles';
import { getSettings } from '@/lib/settings';
import { sp1 } from '@/lib/url';
import { mandalChoice } from '@/lib/mandal';
import { todayLocal } from '@/lib/forms';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('fundraise.add') };
}

/**
 * Start a fundraise: from its group (/fundraise/new?group=<id>), or without one from the
 * Fundraise page (/fundraise/new — a standalone fundraise, fundraise managers only).
 */
export default async function NewFundraisePage({ searchParams }) {
    const sp = await searchParams;
    const user = await requireUser();
    const parsed = Number.parseInt(sp1(sp.group), 10);
    const groupId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    if (!(await canCreateFundraiseIn(user, groupId))) redirect(groupId ? '/groups' : '/fundraise');
    // ?kind=mandal: a Mandal (savings circle) — always of the group it is started from.
    const kind = groupId && sp1(sp.kind) === 'mandal' ? 'mandal' : 'fundraise';

    const { t, locale } = await getT();
    const all = canManageAllFundraises(user.role);
    const [groups, mine, locations, settings, castes, suggestions] = await Promise.all([
        listGroupsForSelect(),
        all ? [] : createFundraiseGroupIds(user.id),
        knownLocations(),
        getSettings('fundraise'),
        casteOptions(locale),
        audienceSuggestions(),
    ]);
    // The group select still lets the creator switch to another group they may create in.
    const allowed = all ? groups : groups.filter((g) => mine.includes(g.id));
    const group = groupId ? groups.find((g) => g.id === groupId) : null;
    if (groupId && !group) redirect('/groups'); // archived group
    const mandal = kind === 'mandal' ? await mandalChoice(groupId) : null;
    const back = group ? { href: `/groups/${groupId}`, label: localized(group, 'name', locale) } : { href: '/fundraise', label: t('fundraise.title') };

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={kind === 'mandal' ? t('mandal.new') : t('fundraise.add')}
                subtitle={group ? localized(group, 'name', locale) : t('fundraise.standalone')}
                back={back}
                actions={<StatusSelect t={t} />}
            />
            <CampaignForm
                kind={kind}
                mandalPeople={mandal?.people}
                today={todayLocal()}
                groups={allowed}
                defaultGroupId={groupId}
                // Other groups it may also be shown in: the ones this user may create in.
                otherGroups={allowed.filter((g) => g.id !== groupId)}
                // Fundraise managers may leave it without a home group.
                allowNoGroup={all}
                cancelHref={back.href}
                locations={locations}
                defaultPublic={settings.default_public}
                castes={castes}
                suggestions={suggestions}
            />
        </div>
    );
}
