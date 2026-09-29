import 'server-only';
import { query, queryOne } from './db';
import { canEditDetails, canManageMembership, standingFrom } from './group-roles';
import { canManageAllFundraises, canManageGroups } from './roles';

/** Is the user an admin of this specific group (admin_group_members.member_role)? */
export async function isGroupAdmin(userId, groupId) {
    if (!userId || !groupId) return false;
    const row = await queryOne(
        `SELECT 1 AS ok FROM admin_group_members WHERE group_id = :groupId AND user_id = :userId AND member_role = 'admin'`,
        { groupId, userId },
    );
    return Boolean(row);
}

/** Group ids where this user may start fundraises: its admins and sub-admins. */
export async function fundraiseGroupIds(userId) {
    const rows = await query(
        `SELECT group_id FROM admin_group_members WHERE user_id = :userId AND member_role IN ('admin', 'sub_admin')`,
        { userId },
    );
    return rows.map((r) => r.group_id);
}

/** Group ids this user administers. */
export async function adminGroupIds(userId) {
    const rows = await query(
        `SELECT group_id FROM admin_group_members WHERE user_id = :userId AND member_role = 'admin'`,
        { userId },
    );
    return rows.map((r) => r.group_id);
}

/** The user's role in one group (admin_group_members.member_role), or null. */
export async function groupRoleOf(userId, groupId) {
    if (!userId || !groupId) return null;
    const row = await queryOne('SELECT member_role FROM admin_group_members WHERE group_id = :groupId AND user_id = :userId', { groupId, userId });
    return row?.member_role ?? null;
}

/**
 * How the user stands in a group: 'app' | 'admin' | 'sub_admin' | null (lib/group-roles.js),
 * plus their own row's role.
 * @returns {Promise<{ standing: string|null, myRole: string|null }>}
 */
export async function groupStanding(user, groupId) {
    if (!user) return { standing: null, myRole: null };
    const myRole = await groupRoleOf(user.id, groupId);
    return { standing: standingFrom(canManageGroups(user.role), myRole), myRole };
}

/** Manage a group's membership and meetings: app-level group managers, its admins and sub-admins. */
export async function canManageGroup(user, groupId) {
    return canManageMembership((await groupStanding(user, groupId)).standing);
}

/** Edit a group's details and discussion setting: app-level group managers, its admins and sub-admins. */
export async function canEditGroupDetails(user, groupId) {
    return canEditDetails((await groupStanding(user, groupId)).standing);
}

// admin manages the fundraise (the creator starts as admin); the rest are informational.
export const FUNDRAISE_TEAM_ROLES = ['admin', 'organizer', 'treasurer', 'collector', 'volunteer'];

/** The user's role on one fundraise's team (fundraise_members), or null. */
export async function fundraiseTeamRole(userId, campaignId) {
    if (!userId || !campaignId) return null;
    const row = await queryOne(
        'SELECT member_role FROM fundraise_members WHERE campaign_id = :campaignId AND user_id = :userId',
        { campaignId, userId },
    );
    return row?.member_role ?? null;
}

/**
 * Everything one user may do on one fundraise, resolved in one place so pages and
 * actions cannot disagree.
 *   manage       — record / edit / delete contributions and expenses, edit the fundraise,
 *                  public link, team, meetings: super_admin, administrator, sub_admin, admins
 *                  of the fundraise's group, and the fundraise's own admins (team role 'admin').
 *   contribution — same as manage (kept separate so callers need not change)
 *   expense      — same as manage
 *   post         — updates / minutes: manage and any team member
 *   teamRole     — 'admin' grants manage; organizer / treasurer / collector / volunteer are
 *                  informational (shown and notified, no write access to the ledger).
 * Viewing needs no permission: every signed-in member sees every non-draft fundraise.
 *   groupAdmin   — an admin of ANY group the fundraise is shown in (fundraise_groups) manages it.
 * @param {{id: number, role: string}} user
 * @param {{id: number, group_id: number|null}} campaign
 */
export async function fundraisePermissions(user, campaign) {
    const none = { manage: false, contribution: false, expense: false, post: false, teamRole: null };
    if (!user || !campaign) return none;
    const appLevel = canManageAllFundraises(user.role);
    const [teamRole, groupAdmin] = await Promise.all([
        fundraiseTeamRole(user.id, campaign.id),
        !appLevel ? isAdminOfFundraiseGroup(user.id, campaign.id) : false,
    ]);
    // A fundraise admin (its creator, or anyone an admin promoted) manages it even without
    // being a group admin; once demoted, they lose it like anyone else.
    const manage = appLevel || groupAdmin || teamRole === 'admin';
    return { manage, contribution: manage, expense: manage, post: manage || Boolean(teamRole), teamRole };
}

/**
 * Manage a fundraise (edit, delete rows, public link, team, meetings).
 * @param {{id: number, role: string}} user
 * @param {{id: number, group_id: number|null}} campaign
 */
export async function canManageFundraise(user, campaign) {
    return (await fundraisePermissions(user, campaign)).manage;
}

/** Admin of any group this fundraise is shown in (fundraise_groups)? */
export async function isAdminOfFundraiseGroup(userId, campaignId) {
    if (!userId || !campaignId) return false;
    const row = await queryOne(
        `SELECT 1 AS ok FROM fundraise_groups fg
           JOIN admin_group_members gm ON gm.group_id = fg.group_id AND gm.user_id = :userId AND gm.member_role = 'admin'
          WHERE fg.campaign_id = :campaignId LIMIT 1`,
        { userId, campaignId },
    );
    return Boolean(row);
}

/** Admin or sub-admin of any group this fundraise is shown in (fundraise_groups)? */
export async function isLeaderOfFundraiseGroup(userId, campaignId) {
    if (!userId || !campaignId) return false;
    const row = await queryOne(
        `SELECT 1 AS ok FROM fundraise_groups fg
           JOIN admin_group_members gm ON gm.group_id = fg.group_id AND gm.user_id = :userId AND gm.member_role IN ('admin', 'sub_admin')
          WHERE fg.campaign_id = :campaignId LIMIT 1`,
        { userId, campaignId },
    );
    return Boolean(row);
}

/** Member (any role) of any group this fundraise is shown in? */
export async function isInFundraiseGroup(userId, campaignId) {
    if (!userId || !campaignId) return false;
    const row = await queryOne(
        `SELECT 1 AS ok FROM fundraise_groups fg
           JOIN admin_group_members gm ON gm.group_id = fg.group_id AND gm.user_id = :userId
          WHERE fg.campaign_id = :campaignId LIMIT 1`,
        { userId, campaignId },
    );
    return Boolean(row);
}

/**
 * May the user START a fundraise under this group — its admins and sub-admins (null group =
 * a standalone fundraise: only app-level fundraise managers)?
 */
export async function canCreateFundraiseIn(user, groupId) {
    if (canManageAllFundraises(user.role)) return true;
    if (!groupId) return false;
    const role = await groupRoleOf(user.id, groupId);
    return role === 'admin' || role === 'sub_admin';
}
