// Pure module — client and server. Roles inside one group (admin_group_members.member_role),
// strongest first:
//   admin      runs the group: details, discussion setting, every member and role
//   sub_admin  helps run it: adds / removes plain members and speakers, sets those two roles,
//              schedules meetings — but never touches an admin or another sub-admin
//   speaker    may post in the discussion even when it is limited (chat_mode = 'restricted')
//   member     reads everything; posts only while the discussion is open to all
// "standing" is how the ACTOR relates to the group: 'app' (app-level group manager),
// 'admin', 'sub_admin', or null (anyone else, including speakers and members).

export const GROUP_ROLES = ['admin', 'sub_admin', 'speaker', 'member'];

/** Group visibility (admin_groupsmeta.visibility): public = listed for everyone; private = only its members (and app-level managers). */
export const GROUP_VISIBILITY = ['public', 'private'];

/** Discussion setting (admin_groupsmeta.chat_mode): everyone posts, or only admins, sub-admins and speakers. */
export const CHAT_MODES = ['all', 'restricted'];

const HELPER_ROLES = ['member', 'speaker'];

/** Standing from an app-level flag and the actor's own row in the group. */
export function standingFrom(appLevel, myRole) {
    if (appLevel) return 'app';
    return myRole === 'admin' || myRole === 'sub_admin' ? myRole : null;
}

/** May manage membership at all (add people, open the Members tab controls, meetings). */
export function canManageMembership(standing) {
    return standing === 'app' || standing === 'admin' || standing === 'sub_admin';
}

/** Group details and the discussion setting: admins only. */
export function canAdminister(standing) {
    return standing === 'app' || standing === 'admin';
}

/**
 * May the actor act on someone whose current role is `targetRole` (null = not in the group
 * yet) — remove them, or give them `nextRole`?
 */
export function canActOnRole(standing, targetRole, nextRole) {
    if (!GROUP_ROLES.includes(nextRole ?? 'member')) return false;
    if (canAdminister(standing)) return true;
    if (standing !== 'sub_admin') return false;
    return HELPER_ROLES.includes(targetRole ?? 'member') && (nextRole == null || HELPER_ROLES.includes(nextRole));
}

/** May post in a group discussion with this setting? */
export function canPostIn(chatMode, standing, myRole) {
    if (standing) return true;
    if (!myRole) return false;
    return chatMode !== 'restricted' || myRole === 'speaker';
}
