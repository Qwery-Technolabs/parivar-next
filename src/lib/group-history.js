import 'server-only';
import { query } from './db';

// A group's own history (admin_group_history) — About → History, its admins only; its admins can clear it.
// Separate from the app-wide activity log (admin_audit_log), which is never cleared from a group.
//   edit              detail.changes: [{ field, from?, to? }]  (name / name_local / visibility with values;
//                     description / picture / who_can_post as "changed")
//   status            detail: { from, to }  (active / inactive / archived)
//   member_add / member_remove            user_id = the member
//   role              user_id, detail: { from, to }  (main role)
//   team              user_id, detail: { from, to, added: [], removed: [] }  (Team card)
//   team_remove       user_id, detail: { from }
//   fundraise_create / fundraise_link / fundraise_unlink   detail: { campaignId, title }
export const GROUP_HISTORY_ACTIONS = [
    'edit',
    'status',
    'member_add',
    'member_remove',
    'role',
    'team',
    'team_remove',
    'fundraise_create',
    'fundraise_link',
    'fundraise_unlink',
];

/**
 * Add one entry. Never throws (history must not break the action it records). `q` = a transaction's query.
 * @param {number} groupId
 * @param {number|null} actorId
 * @param {string} action  one of GROUP_HISTORY_ACTIONS
 * @param {{ userId?: number|null, [k: string]: unknown }} [detail]
 */
export async function recordGroupHistory(groupId, actorId, action, { userId = null, ...detail } = {}, q = query) {
    if (!groupId || !GROUP_HISTORY_ACTIONS.includes(action)) return;
    try {
        await q('INSERT INTO admin_group_history (group_id, action, actor_id, user_id, detail) VALUES (:gid, :action, :actor, :uid, :detail)', {
            gid: Number(groupId),
            action,
            actor: actorId ?? null,
            uid: userId ? Number(userId) : null,
            detail: Object.keys(detail).length ? JSON.stringify(detail) : null,
        });
    } catch (err) {
        console.error('group history not written', err.message);
    }
}

/** The same entry for every group a fundraise is shown in (its home group and linked groups). */
export async function recordFundraiseInGroups(groupIds, actorId, action, detail) {
    for (const gid of new Set(groupIds.filter(Boolean).map(Number))) await recordGroupHistory(gid, actorId, action, detail);
}

/** Newest first, with who did it and whom it was about (names in both scripts). */
export async function listGroupHistory(groupId, limit = 100) {
    const rows = await query(
        `SELECT h.id, h.action, h.actor_id, h.user_id, h.detail, h.created_at,
                a.full_name AS actor, a.full_name_local AS actor_local, u.full_name AS person, u.full_name_local AS person_local
           FROM admin_group_history h
           LEFT JOIN users_list a ON a.id = h.actor_id
           LEFT JOIN users_list u ON u.id = h.user_id
          WHERE h.group_id = :groupId
          ORDER BY h.created_at DESC, h.id DESC
          LIMIT ${Math.min(300, Math.max(1, Number(limit) || 100))}`,
        { groupId },
    );
    return rows.map((r) => {
        let detail = {};
        try {
            detail = r.detail ? (typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail) : {};
        } catch {
            detail = {};
        }
        return { ...r, detail };
    });
}

export async function countGroupHistory(groupId) {
    const [r] = await query('SELECT COUNT(*) AS n FROM admin_group_history WHERE group_id = :groupId', { groupId });
    return Number(r?.n ?? 0);
}
