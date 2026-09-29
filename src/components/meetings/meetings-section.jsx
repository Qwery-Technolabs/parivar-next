import { getCurrentUser } from '@/lib/auth';
import { todayIST } from '@/lib/forms';
import { candidatePeople, listMeetings, meetingScope } from '@/lib/meetings';
import MeetingList from './meeting-list';

/**
 * Server wrapper: loads the meetings of one group or fundraise, who can be invited, and
 * whether the viewer may schedule. Pages only place it.
 * @param {{ scope: 'group'|'fundraise', scopeId: number, defaultTitle?: string, defaultPlace?: string }} props
 */
export default async function MeetingsSection({ scope, scopeId, defaultTitle = '', defaultPlace = '', minutes = [], canPostMinutes = false }) {
    const user = await getCurrentUser();
    const ctx = await meetingScope(user, scope, scopeId);
    if (!ctx) return null;
    const [meetings, people] = await Promise.all([listMeetings(scope, scopeId, user.id), candidatePeople(ctx.candidateIds)]);
    return (
        <MeetingList
            meetings={meetings}
            scope={scope}
            scopeId={scopeId}
            manage={ctx.manage}
            people={people}
            me={user.id}
            today={todayIST()}
            defaultTitle={defaultTitle}
            defaultPlace={defaultPlace}
            minutes={minutes}
            canPostMinutes={canPostMinutes}
        />
    );
}
