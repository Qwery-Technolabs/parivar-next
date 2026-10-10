// Pure module — client and server. Roles inside one group (admin_group_members.member_role),
// strongest first:
//   admin      runs the group: details, discussion setting, every member and role
//   sub_admin  helps run it: edits the group details, adds / removes plain members and
//              speakers, sets those two roles, schedules meetings — but never touches an
//              admin or another sub-admin
//   speaker    a member whose role exists to be allowed to post when members may not
//   member     reads everything; posts if the group lets members post
// Who may post is chosen per group (admin_groupsmeta.chat_roles); admins always may.
// "standing" is how the ACTOR relates to the group: 'app' (app-level group manager),
// 'admin', 'sub_admin', or null (anyone else, including speakers and members).

export const GROUP_ROLES = ['admin', 'sub_admin', 'speaker', 'member'];

/**
 * The group's team (admin_group_team, one row per role — a person can hold several), like a fundraise team:
 * task roles given to members or speakers. Admins and sub-admins can already do all of them.
 *   members     add / edit / remove plain members and speakers
 *   fundraise   start fundraisers in the group (they then edit only the ones they started)
 *   meetings    schedule meetings (and edit / cancel the ones they scheduled)
 *   details     edit the group's details
 *   discussion  always allowed to post in the discussion
 */
export const GROUP_TEAM_ROLES = ['members', 'fundraise', 'meetings', 'details', 'discussion'];

/** Leads the group (every task, the danger zone, the team): app-level group managers, its admins and sub-admins. */
export function isGroupLeader(standing) {
    return standing === 'app' || standing === 'admin' || standing === 'sub_admin';
}

/** May the actor do one task (a GROUP_TEAM_ROLES key): leaders always, others when they hold that team role. */
export function groupCan(standing, team, task) {
    return isGroupLeader(standing) || (team ?? []).includes(task);
}

/**
 * Group status (admin_groups.status): active; inactive = still listed and readable, nobody can post;
 * archived = hidden from members (app-level group managers and the group's admins still open it),
 * and only then deletable.
 */
export const GROUP_STATUSES = ['active', 'inactive', 'archived'];
/** Status dot on a group's picture: green active, red inactive, grey archived. */
export const GROUP_STATUS_DOT = { active: 'bg-emerald-500', inactive: 'bg-red-600', archived: 'bg-gray-400' };

/** Group visibility (admin_groupsmeta.visibility): public = listed for everyone; private = only its members (and app-level managers). */
export const GROUP_VISIBILITY = ['public', 'private'];

/**
 * Roles that may post in a group's discussion, from admin_groupsmeta: chat_roles is a comma
 * list (absent = every role). Groups saved before it may still carry chat_mode = 'restricted',
 * which meant admins, sub-admins and speakers. Admin is always included.
 * @returns {string[]}
 */
export function chatRolesFrom(chatRoles, chatMode) {
    let roles = chatRoles
        ? String(chatRoles)
              .split(',')
              .filter((r) => GROUP_ROLES.includes(r))
        : chatMode === 'restricted'
          ? ['admin', 'sub_admin', 'speaker']
          : [...GROUP_ROLES];
    if (!roles.includes('admin')) roles = ['admin', ...roles];
    return GROUP_ROLES.filter((r) => roles.includes(r));
}

const HELPER_ROLES = ['member', 'speaker'];

/** Standing from an app-level flag and the actor's own row in the group. */
export function standingFrom(appLevel, myRole) {
    if (appLevel) return 'app';
    return myRole === 'admin' || myRole === 'sub_admin' ? myRole : null;
}

/** May manage membership (add people, the Members tab controls): leaders, and the "members" team role. */
export function canManageMembership(standing, team = []) {
    return groupCan(standing, team, 'members');
}

/** Edit the group's details (name, picture, visibility, who can post, description): leaders, and the "details" team role. */
export function canEditDetails(standing, team = []) {
    return groupCan(standing, team, 'details');
}

/** Full say over the group's people: admins (and app-level managers) only. */
export function canAdminister(standing) {
    return standing === 'app' || standing === 'admin';
}

/**
 * May the actor act on someone whose current role is `targetRole` (null = not in the group
 * yet) — remove them, or give them `nextRole`?
 */
export function canActOnRole(standing, targetRole, nextRole, team = []) {
    if (!GROUP_ROLES.includes(nextRole ?? 'member')) return false;
    if (canAdminister(standing)) return true;
    // A sub-admin, or someone with the "members" team role: plain members and speakers only.
    if (standing !== 'sub_admin' && !(team ?? []).includes('members')) return false;
    return HELPER_ROLES.includes(targetRole ?? 'member') && (nextRole == null || HELPER_ROLES.includes(nextRole));
}

/** May post in a group discussion, given the roles allowed there (chatRolesFrom)? App-level managers always may. */
export function canPostIn(allowedRoles, standing, myRole, team = []) {
    if (standing === 'app') return true;
    if ((team ?? []).includes('discussion')) return Boolean(myRole);
    return Boolean(myRole) && allowedRoles.includes(myRole);
}

/** Give or take team roles: the group's leaders, on plain members and speakers (leaders already do everything). */
export function canSetTeam(standing, targetRole) {
    if (canAdminister(standing)) return true;
    return standing === 'sub_admin' && HELPER_ROLES.includes(targetRole ?? 'member');
}
