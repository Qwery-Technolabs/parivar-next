import 'server-only';
import { fundraisePermissions, groupStanding, isInFundraiseGroup } from './access';
import { canPostIn } from './group-roles';
import { query, queryOne, setMeta } from './db';
import { canManageAllFundraises, canManageGroups } from './roles';

export const CHAT_SCOPES = ['group', 'fundraise'];
export const CHAT_PAGE = 60;
export const CHAT_MAX_LENGTH = 2000;

/**
 * Who may read and write a discussion. Reading and posting are the same right: a
 * discussion is for the people in it.
 *   group     — that group's members, and app-level group managers
 *   fundraise — its team, members of any group it is shown in, and fundraise managers
 * A group admin may limit posting (admin_groupsmeta.chat_mode = 'restricted'): then only
 * admins, sub-admins and speakers post; everyone else in the group still reads.
 * @returns {Promise<{ allowed: boolean, canPost: boolean, moderate: boolean }>} moderate = may delete others' messages
 */
export async function chatAccess(user, scope, scopeId) {
    const none = { allowed: false, canPost: false, moderate: false };
    if (!user || !CHAT_SCOPES.includes(scope) || !scopeId) return none;
    if (scope === 'group') {
        const group = await queryOne(
            `SELECT g.id, m.meta_value AS chat_mode FROM admin_groups g
               LEFT JOIN admin_groupsmeta m ON m.group_id = g.id AND m.meta_key = 'chat_mode'
              WHERE g.id = :scopeId`,
            { scopeId },
        );
        if (!group) return none;
        const { standing, myRole } = await groupStanding(user, scopeId);
        if (!standing && !myRole) return none;
        return { allowed: true, canPost: canPostIn(group.chat_mode, standing, myRole), moderate: Boolean(standing) };
    }
    const campaign = await queryOne('SELECT id, group_id FROM fundraise_campaigns WHERE id = :scopeId', { scopeId });
    if (!campaign) return none;
    if (canManageAllFundraises(user.role)) return { allowed: true, canPost: true, moderate: true };
    const [perms, member] = await Promise.all([fundraisePermissions(user, campaign), isInFundraiseGroup(user.id, campaign.id)]);
    const allowed = perms.post || member;
    return { allowed, canPost: allowed, moderate: perms.manage };
}

/**
 * The latest messages of a thread, oldest first (the order they are read in).
 * @param {string} scope
 * @param {number} scopeId
 */
export async function listMessages(scope, scopeId) {
    const rows = await query(
        `SELECT m.id, m.user_id, m.created_at, m.deleted_at, b.meta_value AS body, k.meta_value AS kind, d.meta_value AS data,
                u.full_name, u.full_name_local
           FROM chat_messages m
           LEFT JOIN chat_messagesmeta b ON b.message_id = m.id AND b.meta_key = 'body'
           LEFT JOIN chat_messagesmeta k ON k.message_id = m.id AND k.meta_key = 'kind'
           LEFT JOIN chat_messagesmeta d ON d.message_id = m.id AND d.meta_key = 'data'
           LEFT JOIN users_list u ON u.id = m.user_id
          WHERE m.scope = :scope AND m.scope_id = :scopeId
          ORDER BY m.id DESC
          LIMIT ${CHAT_PAGE}`,
        { scope, scopeId },
    );
    return rows.reverse();
}

/**
 * A system note in a thread (shown centred, like WhatsApp's "X created a meeting"): a normal
 * message row by the person who acted, with meta kind + data (JSON). body holds a plain
 * summary so previews and older clients still read sensibly.
 * @param {'group'|'fundraise'} scope
 * @param {number} scopeId
 * @param {number} userId
 * @param {'meeting'} kind
 * @param {object} data
 * @param {string} body
 */
export async function postSystemMessage(scope, scopeId, userId, kind, data, body) {
    const r = await query('INSERT INTO chat_messages (scope, scope_id, user_id) VALUES (:scope, :scopeId, :userId)', { scope, scopeId, userId });
    await setMeta('chat_messages', r.insertId, { body, kind, data: JSON.stringify(data) });
    return r.insertId;
}

/**
 * "Asha added Ravi, Mina" / "Asha removed Ravi" in a group's discussion — the membership
 * history lives in the thread, WhatsApp-style. Best effort: never fails the change itself.
 * @param {number} groupId
 * @param {number} actorId
 * @param {'added'|'removed'} action
 * @param {number[]} userIds
 */
export async function postMemberNote(groupId, actorId, action, userIds) {
    if (!userIds.length) return;
    try {
        const ids = userIds.slice(0, 50);
        const people = await query(
            `SELECT id, full_name, full_name_local FROM users_list WHERE id IN (${ids.map((_, i) => `:u${i}`).join(',')})`,
            Object.fromEntries(ids.map((v, i) => [`u${i}`, v])),
        );
        const data = {
            action,
            names: people.map((p) => p.full_name),
            names_local: people.map((p) => p.full_name_local || p.full_name),
            more: Math.max(0, userIds.length - ids.length),
        };
        await postSystemMessage('group', groupId, actorId, 'member', data, `${action}: ${data.names.join(', ')}`);
    } catch (err) {
        console.error('member note failed', err.message);
    }
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
