import 'server-only';
import { getMeta, query, queryOne } from './db';

export async function listGroups() {
    // Counts come from one grouped read of the membership table, not a subquery per group.
    return query(
        `SELECT g.id, g.name, g.name_gu, g.status, g.created_at,
                COALESCE(c.members, 0) AS members, COALESCE(c.admins, 0) AS admins
           FROM admin_groups g
           LEFT JOIN (SELECT group_id, COUNT(*) AS members, SUM(member_role = 'admin') AS admins
                        FROM admin_group_members GROUP BY group_id) c ON c.group_id = g.id
          WHERE g.status = 'active'
          ORDER BY g.name`,
    );
}

export async function getGroup(id) {
    const g = await queryOne('SELECT id, name, name_gu, status, created_at FROM admin_groups WHERE id = :id', { id });
    if (!g) return null;
    return { ...g, meta: await getMeta('admin_groups', id) };
}

export async function groupMembers(groupId) {
    return query(
        `SELECT u.id, u.full_name, u.full_name_gu, u.phone, u.village, u.role, gm.member_role, gm.added_at
           FROM admin_group_members gm JOIN users_list u ON u.id = gm.user_id
          WHERE gm.group_id = :groupId
          ORDER BY gm.member_role = 'admin' DESC, u.full_name`,
        { groupId },
    );
}

export async function groupFundraises(groupId) {
    return query(
        `SELECT id, title, title_gu, status, start_date, end_date FROM fundraise_campaigns
          WHERE group_id = :groupId ORDER BY status = 'active' DESC, start_date DESC LIMIT 20`,
        { groupId },
    );
}
