import 'server-only';
import { inList, query, queryOne } from './db';
import { pushToUsers } from './push';

/**
 * Notification types. Each maps to `notifications.types.<type>` in the dictionaries,
 * interpolated with `data` at read time — so the text follows the READER's language.
 */
export const NOTIFICATION_TYPES = [
    'blood.request', // data: { group, patient, city }
    'group.admin', // data: { group }
    'group.member', // data: { group }
    'fundraise.role', // data: { title, role }
    'fundraise.meeting', // data: { title, date, time, place }
    'fundraise.update', // data: { title }
    'event.new', // data: { title, date }
];

/**
 * Notify many users at once. Never throws: a failed notification must not undo the
 * action that caused it. The actor is never notified about their own action.
 * @param {Array<number>} userIds
 * @param {{ type: string, data?: object, link?: string, actorId?: number|null }} n
 */
export async function notifyMany(userIds, { type, data = {}, link = null, actorId = null }) {
    const ids = [...new Set(userIds.map(Number))].filter((id) => id > 0 && id !== actorId);
    if (!ids.length) return 0;
    try {
        // One multi-row INSERT per 200 recipients: a village-wide blood request can reach
        // hundreds of donors, and a statement per person would hold the request open.
        for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200);
            const params = { type, data: JSON.stringify(data), link, actorId };
            const values = chunk.map((id, j) => {
                params[`u${j}`] = id;
                return `(:u${j}, :type, :data, :link, :actorId)`;
            });
            await query(`INSERT INTO users_notifications (user_id, type, data, link, actor_id) VALUES ${values.join(', ')}`, params);
        }
        // Browser push goes out after the rows exist, and does not hold up the caller.
        pushToUsers(ids, { type, data, link }).catch(() => {});
        return ids.length;
    } catch (err) {
        console.error('notify failed', type, err.message);
        return 0;
    }
}

export async function notify(userId, n) {
    return notifyMany([userId], n);
}

/** Active users matching a blood group list who opted in as donors. */
export async function donorIdsFor(groups) {
    const l = inList(groups, 'bg');
    const rows = await query(
        `SELECT id FROM users_list WHERE status = 'active' AND is_blood_donor = 1 AND blood_group IN (${l.sql})`,
        l.params,
    );
    return rows.map((r) => r.id);
}

/** Everyone connected to a fundraise: its team plus the members of every group it is shown in. */
export async function fundraiseAudienceIds(campaignId) {
    const rows = await query(
        `SELECT user_id FROM fundraise_members WHERE campaign_id = :campaignId
         UNION
         SELECT gm.user_id FROM admin_group_members gm
           JOIN fundraise_groups fg ON fg.group_id = gm.group_id
          WHERE fg.campaign_id = :campaignId`,
        { campaignId },
    );
    return rows.map((r) => r.user_id);
}

export async function unreadCount(userId) {
    const row = await queryOne(
        'SELECT COUNT(*) AS n FROM users_notifications WHERE user_id = :userId AND read_at IS NULL',
        { userId },
    );
    return row.n;
}

/** Newest first. perPage is clamped by the caller and inlined. */
export async function listNotifications(userId, page, perPage) {
    const offset = (page - 1) * perPage;
    const [countRow, rows] = await Promise.all([
        queryOne('SELECT COUNT(*) AS n FROM users_notifications WHERE user_id = :userId', { userId }),
        query(
            `SELECT n.id, n.type, n.data, n.link, n.read_at, n.created_at, a.full_name AS actor_name, a.full_name_local AS actor_name_local
               FROM users_notifications n LEFT JOIN users_list a ON a.id = n.actor_id
              WHERE n.user_id = :userId
              ORDER BY n.id DESC
              LIMIT ${perPage} OFFSET ${offset}`,
            { userId },
        ),
    ]);
    return { total: countRow.n, rows };
}
