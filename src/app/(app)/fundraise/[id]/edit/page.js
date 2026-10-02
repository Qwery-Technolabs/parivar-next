import { notFound, redirect } from 'next/navigation';
import CampaignForm from '@/components/fundraise/campaign-form';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { deleteCampaign, setCampaignArchived } from '@/app/actions/fundraise';
import PageHeader from '@/components/shell/page-header';
import PageMenu from '@/components/shell/page-menu';
import StatusSelect from '@/components/fundraise/status-select';
import { fundraiseGroupIds, canManageFundraise } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { audienceSuggestions, getAudience, getCampaign, knownLocations, listGroupsForSelect } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { queryOne } from '@/lib/db';
import { allMarks, mandalChoice, mandalMeetings } from '@/lib/mandal';
import { todayLocal } from '@/lib/forms';
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
        all ? [] : fundraiseGroupIds(user.id),
        knownLocations(),
        getAudience(campaign.id),
        casteOptions(locale),
        audienceSuggestions(),
    ]);
    const allowed = all ? groups : groups.filter((g) => mine.includes(g.id) || g.id === campaign.group_id);
    // Keep the current group selectable even if it was archived since (the list holds active groups only).
    if (campaign.group_id && !allowed.some((g) => g.id === campaign.group_id))
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
    // A Mandal's opening balance is its "Opening balance" contribution row.
    const openingId = Number(campaign.meta?.opening_contribution_id) || null;
    const mandal = campaign.kind === 'mandal' ? await mandalChoice(campaign.group_id, campaign.id) : null;
    // Its schedules, each with what was received at it (decides Archive vs Delete).
    let schedules = [];
    if (mandal) {
        const [meetings, marks] = await Promise.all([mandalMeetings(campaign.id, 0), allMarks(campaign.id)]);
        schedules = meetings.map((e) => ({
            id: e.id,
            start_date: e.start_date,
            location: e.location,
            installment: e.installment,
            holder: e.holder ? { id: e.holder.id } : null,
            archived: e.archived,
            received: Object.values(marks[e.id] ?? {}).reduce((s, x) => s + Number(x.paid || 0), 0),
        }));
    }
    const openingBalance = openingId
        ? ((await queryOne('SELECT amount FROM fundraise_contributions WHERE id = :openingId AND deleted_at IS NULL', { openingId }))?.amount ?? '')
        : '';

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={t('fundraise.edit')}
                subtitle={localized(campaign, 'title', locale)}
                back={campaign.group_id ? { href: `/groups/${campaign.group_id}`, label: groupName } : { href: '/fundraise', label: t('fundraise.title') }}
                // Status left of the kebab; it still saves with the form below.
                actions={<StatusSelect value={campaign.status} t={t} />}
                // Project admins: Archive — and once archived, Restore or Delete — in the kebab.
                menu={
                    all && (
                        <PageMenu
                            items={
                                campaign.archived_at
                                    ? [
                                          { key: 'restore', label: t('fundraise.restore'), icon: <ArchiveRestore />, action: setCampaignArchived.bind(null, campaign.id, false) },
                                          {
                                              key: 'delete',
                                              label: t('fundraise.deleteCampaign'),
                                              icon: <Trash2 />,
                                              action: deleteCampaign.bind(null, campaign.id),
                                              confirm: t('fundraise.deleteCampaignConfirm'),
                                              danger: true,
                                          },
                                      ]
                                    : [
                                          {
                                              key: 'archive',
                                              label: t('fundraise.archive'),
                                              icon: <Archive />,
                                              action: setCampaignArchived.bind(null, campaign.id, true),
                                              confirm: t('fundraise.archiveConfirm'),
                                          },
                                      ]
                            }
                        />
                    )
                }
            />
            <div className="space-y-4">
                {/* The form draws its own card; Status sits above it. */}
                <CampaignForm
                    campaign={{ ...campaign, openingBalance }}
                    groups={allowed}
                    otherGroups={otherGroups}
                    allowNoGroup={all || !campaign.group_id}
                    cancelHref={`/fundraise/${campaign.id}`}
                    locations={locations}
                    audience={audience.map((a) => ({ kind: a.kind, value: a.value }))}
                    castes={castes}
                    suggestions={suggestions}
                    mandalPeople={mandal?.people}
                    mandalMemberIds={mandal?.memberIds}
                    mandalSchedules={schedules}
                    today={todayLocal()}
                />
            </div>
        </div>
    );
}
