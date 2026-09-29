import 'server-only';
import { getMeta, getMetaMany, query, queryOne } from './db';

export async function listGroups() {
    // Counts come from one grouped read of the membership table, not a subquery per group.
    return query(
        `SELECT g.id, g.name, g.name_local, g.status, g.created_at,
                COALESCE(c.members, 0) AS members, COALESCE(c.admins, 0) AS admins
           FROM admin_groups g
           LEFT JOIN (SELECT group_id, COUNT(*) AS members, SUM(member_role = 'admin') AS admins
                        FROM admin_group_members GROUP BY group_id) c ON c.group_id = g.id
          WHERE g.status = 'active'
          ORDER BY g.name`,
    );
}

export async function getGroup(id) {
    const g = await queryOne('SELECT id, name, name_local, status, created_at, created_by FROM admin_groups WHERE id = :id', { id });
    if (!g) return null;
    return { ...g, meta: await getMeta('admin_groups', id) };
}

export async function groupMembers(groupId) {
    return query(
        `SELECT u.id, u.full_name, u.full_name_local, u.phone, u.village, u.role, u.last_login_at, gm.member_role, gm.added_at
           FROM admin_group_members gm JOIN users_list u ON u.id = gm.user_id
          WHERE gm.group_id = :groupId
          ORDER BY FIELD(gm.member_role, 'admin', 'sub_admin', 'speaker', 'member'), u.full_name`,
        { groupId },
    );
}

export async function groupFundraises(groupId) {
    const rows = await query(
        `SELECT c.id, c.title, c.title_local, c.status, c.start_date, c.end_date, c.target_amount,
                (SELECT COALESCE(SUM(amount), 0) FROM fundraise_contributions WHERE campaign_id = c.id AND deleted_at IS NULL AND mode <> 'unpaid') AS collected,
                (SELECT COALESCE(SUM(amount), 0) FROM fundraise_expenses WHERE campaign_id = c.id AND deleted_at IS NULL) AS spent
           FROM fundraise_campaigns c
          WHERE c.id IN (SELECT campaign_id FROM fundraise_groups WHERE group_id = :groupId) AND c.archived_at IS NULL ORDER BY c.status = 'active' DESC, c.start_date DESC LIMIT 50`,
        { groupId },
    );
    const pics = await getMetaMany('fundraise_campaigns', rows.map((r) => r.id), ['avatar_kind', 'avatar_value', 'avatar_color']);
    return rows.map((r) => ({ ...r, avatar: pics[r.id] ?? {} }));
}

/**
 * The WhatsApp-style chat list: every active group with its latest message, member count,
 * the viewer's own role, and how many messages they have not seen yet. One query — the last
 * message and unread count come from correlated lookups on the (scope, scope_id, id) index.
 * Preview and unread are only meaningful for groups the viewer can read; the page hides them
 * otherwise (non-members see "members only").
 */
export async function listGroupsForChat(userId) {
    const rows = await query(
        `SELECT g.id, g.name, g.name_local,
                (SELECT COUNT(*) FROM admin_group_members m WHERE m.group_id = g.id) AS members,
                gm.member_role AS my_role,
                lm.id AS last_id, lm.created_at AS last_at, lm.deleted_at AS last_deleted,
                lb.meta_value AS last_body, lk.meta_value AS last_kind, lu.full_name AS last_author, lu.full_name_local AS last_author_local,
                lm.user_id AS last_user_id,
                (SELECT COUNT(*) FROM chat_messages x
                  WHERE x.scope = 'group' AND x.scope_id = g.id AND x.deleted_at IS NULL
                    AND x.id > COALESCE(r.last_read_id, 0) AND (x.user_id IS NULL OR x.user_id <> :userId)) AS unread
           FROM admin_groups g
           LEFT JOIN admin_group_members gm ON gm.group_id = g.id AND gm.user_id = :userId
           LEFT JOIN chat_messages lm ON lm.id = (SELECT MAX(id) FROM chat_messages WHERE scope = 'group' AND scope_id = g.id)
           LEFT JOIN chat_messagesmeta lb ON lb.message_id = lm.id AND lb.meta_key = 'body'
           LEFT JOIN chat_messagesmeta lk ON lk.message_id = lm.id AND lk.meta_key = 'kind'
           LEFT JOIN users_list lu ON lu.id = lm.user_id
           LEFT JOIN chat_reads r ON r.user_id = :userId AND r.scope = 'group' AND r.scope_id = g.id
          WHERE g.status = 'active'
          ORDER BY (gm.user_id IS NULL), COALESCE(lm.created_at, g.created_at) DESC`,
        { userId },
    );
    const meta = await getMetaMany('admin_groups', rows.map((r) => r.id), ['avatar_kind', 'avatar_value', 'avatar_color', 'visibility']);
    return rows.map((r) => ({ ...r, avatar: meta[r.id] ?? {}, private: meta[r.id]?.visibility === 'private' }));
}
