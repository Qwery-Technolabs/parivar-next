import 'server-only';
import { query, queryOne } from './db';
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

/** Group ids this user administers. */
export async function adminGroupIds(userId) {
    const rows = await query(
        `SELECT group_id FROM admin_group_members WHERE user_id = :userId AND member_role = 'admin'`,
        { userId },
    );
    return rows.map((r) => r.group_id);
}

/** Manage a group's membership: app-level group managers, or that group's own admins. */
export async function canManageGroup(user, groupId) {
    if (!user) return false;
    if (canManageGroups(user.role)) return true;
    return isGroupAdmin(user.id, groupId);
}

export const FUNDRAISE_TEAM_ROLES = ['organizer', 'treasurer', 'collector', 'volunteer'];

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
 *                  public link, team, meetings: super_admin, administrator, sub_admin, and
 *                  admins of the fundraise's group. Nobody else.
 *   contribution — same as manage (kept separate so callers need not change)
 *   expense      — same as manage
 *   post         — updates / minutes: manage and any team member
 *   teamRole     — informational only (organizer / treasurer / collector / volunteer): shown
 *                  and notified, but it grants no write access to the ledger.
 * Viewing needs no permission: every signed-in member sees every non-draft fundraise.
 * @param {{id: number, role: string}} user
 * @param {{id: number, group_id: number|null}} campaign
 */
export async function fundraisePermissions(user, campaign) {
    const none = { manage: false, contribution: false, expense: false, post: false, teamRole: null };
    if (!user || !campaign) return none;
    const appLevel = canManageAllFundraises(user.role);
    const [teamRole, groupAdmin] = await Promise.all([
        fundraiseTeamRole(user.id, campaign.id),
        !appLevel && campaign.group_id ? isGroupAdmin(user.id, campaign.group_id) : false,
    ]);
    const manage = appLevel || groupAdmin;
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

/** May the user START a fundraise under this group (null group = only app-level managers)? */
export async function canCreateFundraiseIn(user, groupId) {
    if (canManageAllFundraises(user.role)) return true;
    return groupId ? isGroupAdmin(user.id, groupId) : false;
}
