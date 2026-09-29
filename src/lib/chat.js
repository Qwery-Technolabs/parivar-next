import 'server-only';
import { fundraisePermissions } from './access';
import { query, queryOne } from './db';
import { canManageAllFundraises, canManageGroups } from './roles';

export const CHAT_SCOPES = ['group', 'fundraise'];
export const CHAT_PAGE = 60;
export const CHAT_MAX_LENGTH = 2000;

async function isGroupMember(userId, groupId) {
    const row = await queryOne('SELECT 1 AS ok FROM admin_group_members WHERE group_id = :groupId AND user_id = :userId', {
        groupId,
        userId,
    });
    return Boolean(row);
}

/**
 * Who may read and write a discussion. Reading and posting are the same right: a
 * discussion is for the people in it.
 *   group     — that group's members, and app-level group managers
 *   fundraise — its team, its group's members, and fundraise managers
 * @returns {Promise<{ allowed: boolean, moderate: boolean }>} moderate = may delete others' messages
 */
export async function chatAccess(user, scope, scopeId) {
    const none = { allowed: false, moderate: false };
    if (!user || !CHAT_SCOPES.includes(scope) || !scopeId) return none;
    if (scope === 'group') {
        const group = await queryOne('SELECT id FROM admin_groups WHERE id = :scopeId', { scopeId });
        if (!group) return none;
        if (canManageGroups(user.role)) return { allowed: true, moderate: true };
        const admin = await queryOne(
            `SELECT member_role FROM admin_group_members WHERE group_id = :scopeId AND user_id = :userId`,
            { scopeId, userId: user.id },
        );
        return admin ? { allowed: true, moderate: admin.member_role === 'admin' } : none;
    }
    const campaign = await queryOne('SELECT id, group_id FROM fundraise_campaigns WHERE id = :scopeId', { scopeId });
    if (!campaign) return none;
    if (canManageAllFundraises(user.role)) return { allowed: true, moderate: true };
    const [perms, member] = await Promise.all([fundraisePermissions(user, campaign), isGroupMember(user.id, campaign.group_id)]);
    return { allowed: perms.post || member, moderate: perms.manage };
}

/**
 * The latest messages of a thread, oldest first (the order they are read in).
 * @param {string} scope
 * @param {number} scopeId
 */
export async function listMessages(scope, scopeId) {
    const rows = await query(
        `SELECT m.id, m.user_id, m.created_at, m.deleted_at, b.meta_value AS body,
                u.full_name, u.full_name_local
           FROM chat_messages m
           LEFT JOIN chat_messagesmeta b ON b.message_id = m.id AND b.meta_key = 'body'
           LEFT JOIN users_list u ON u.id = m.user_id
          WHERE m.scope = :scope AND m.scope_id = :scopeId
          ORDER BY m.id DESC
          LIMIT ${CHAT_PAGE}`,
        { scope, scopeId },
    );
    return rows.reverse();
}

/** Message count per thread, for the tab badges. */
export async function messageCount(scope, scopeId) {
    const row = await queryOne(
        'SELECT COUNT(*) AS n FROM chat_messages WHERE scope = :scope AND scope_id = :scopeId AND deleted_at IS NULL',
        { scope, scopeId },
    );
    return row.n;
}

/**
 * Remember the newest message this person has seen in a thread (never moves backwards).
 * Called when the discussion is shown; it only feeds unread counts, so it never throws.
 */
export async function markRead(userId, scope, scopeId, lastId) {
    if (!userId || !lastId) return;
    try {
        await query(
            `INSERT INTO chat_reads (user_id, scope, scope_id, last_read_id) VALUES (:userId, :scope, :scopeId, :lastId)
             ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))`,
            { userId, scope, scopeId, lastId },
        );
    } catch (err) {
        console.error('markRead failed', err.message);
    }
}
