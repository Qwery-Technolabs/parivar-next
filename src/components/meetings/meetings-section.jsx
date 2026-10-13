import { getCurrentUser } from '@/lib/auth';
import { todayLocal } from '@/lib/forms';
import { FUNDRAISE_TEAM_ROLES } from '@/lib/access';
import { GROUP_ROLES } from '@/lib/group-roles';
import { getT } from '@/lib/i18n/server';
import { candidatePeople, countPastMeetings, listMeetings, meetingScope, nextMeetingMonth, scopeBirthdays } from '@/lib/meetings';
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
    minutes = {},
    canPostMinutes = false,
    attendance = null,
    // ?view= of the page: 'calendar' loads every meeting + birthdays; the list only upcoming ones (past on open).
    view = 'list',
    // ?month=YYYY-MM of the calendar (default: the next meeting's month, else this one) — one month per load.
    month = null,
}) {
    const user = await getCurrentUser();
    const ctx = await meetingScope(user, scope, scopeId);
    if (!ctx) return null;
    // `minutes` / `attendance` may come as promises from the page: awaited together with the rest.
    const calendar = view === 'calendar';
    const calMonth = calendar
        ? /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')
            ? month
            : ((await nextMeetingMonth(scope, scopeId)) ?? todayLocal().slice(0, 7))
        : null;
    const [meetings, people, birthdays, { t }, minutesList, attendanceData, pastCount] = await Promise.all([
        listMeetings(scope, scopeId, user.id, calendar ? { when: 'month', month: calMonth } : { when: 'upcoming' }),
        candidatePeople(ctx.candidateIds),
        calendar ? scopeBirthdays(scope, scopeId, Number(calMonth.slice(5))) : [],
        getT(),
        minutes,
        attendance,
        calendar ? null : countPastMeetings(scope, scopeId),
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
            moderate={ctx.moderate}
            people={people}
            me={user.id}
            today={todayLocal()}
            defaultTitle={defaultTitle}
            defaultPlace={defaultPlace}
            minutes={minutesList}
            canPostMinutes={canPostMinutes}
            birthdays={birthdays}
            birthdayRoles={birthdayRoles}
            attendance={attendanceData}
            pastCount={pastCount}
            calMonth={calMonth}
        />
    );
}
