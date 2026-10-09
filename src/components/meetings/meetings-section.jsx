import { getCurrentUser } from '@/lib/auth';
import { todayLocal } from '@/lib/forms';
import { FUNDRAISE_TEAM_ROLES } from '@/lib/access';
import { GROUP_ROLES } from '@/lib/group-roles';
import { getT } from '@/lib/i18n/server';
import { candidatePeople, listMeetings, meetingScope, scopeBirthdays } from '@/lib/meetings';
import MeetingList from './meeting-list';

/**
 * Server wrapper: loads the meetings of one group or fundraise, who can be invited, and
 * whether the viewer may schedule. Pages only place it.
 * @param {{ scope: 'group'|'fundraise', scopeId: number, defaultTitle?: string, defaultPlace?: string }} props
 */
export default async function MeetingsSection({
    scope,
    scopeId,
    defaultTitle = '',
    defaultPlace = '',
    minutes = [],
    canPostMinutes = false,
    attendance = null,
}) {
    const user = await getCurrentUser();
    const ctx = await meetingScope(user, scope, scopeId);
    if (!ctx) return null;
    const [meetings, people, birthdays, { t }] = await Promise.all([
        listMeetings(scope, scopeId, user.id),
        candidatePeople(ctx.candidateIds),
        scopeBirthdays(scope, scopeId),
        getT(),
    ]);
    // Whose birthdays to show: the group's roles, or a fundraise's team roles + its groups' members.
    const birthdayRoles =
        scope === 'group'
            ? GROUP_ROLES.map((r) => ({ value: r, label: t(`groups.roles.${r}`) }))
            : [
                  ...FUNDRAISE_TEAM_ROLES.map((r) => ({ value: r, label: t(`fundraise.teamRoles.${r}`) })),
                  { value: 'group_member', label: t('meetings.groupMember') },
              ];
    return (
        <MeetingList
            meetings={meetings}
            scope={scope}
            scopeId={scopeId}
            manage={ctx.manage}
            people={people}
            me={user.id}
            today={todayLocal()}
            defaultTitle={defaultTitle}
            defaultPlace={defaultPlace}
            minutes={minutes}
            canPostMinutes={canPostMinutes}
            birthdays={birthdays}
            birthdayRoles={birthdayRoles}
            attendance={attendance}
        />
    );
}
