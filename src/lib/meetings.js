import 'server-only';
import { canManageGroup, fundraisePermissions } from './access';
import { getMetaMany, inList, query, queryOne } from './db';

/** Reminder choices, minutes before the start. */
export const REMINDER_OFFSETS = [1440, 60, 15, 0];
export const DEFAULT_REMINDERS = [1440, 60];
/** A meeting with a date but no time is treated as starting at 9 in the morning. */
export const DEFAULT_TIME = '09:00:00';

/**
 * Where a meeting belongs and who is involved:
 *   group     — events_list.group_id,   candidates = the group's members
 *   fundraise — events_list.campaign_id, candidates = its team ∪ its group's members
 * @returns {Promise<null | { scope, scopeId, groupId, campaignId, title, titleLocal, manage: boolean, candidateIds: number[], link: string }>}
 */
export async function meetingScope(user, scope, scopeId) {
    if (scope === 'group') {
        const g = await queryOne('SELECT id, name, name_local FROM admin_groups WHERE id = :scopeId', { scopeId });
        if (!g) return null;
        const members = await query('SELECT user_id FROM admin_group_members WHERE group_id = :scopeId', { scopeId });
        return {
            scope,
            scopeId,
            groupId: g.id,
            campaignId: null,
            title: g.name,
            titleLocal: g.name_local,
            manage: await canManageGroup(user, g.id),
            candidateIds: members.map((m) => m.user_id),
            link: `/groups/${g.id}?tab=meetings`,
        };
    }
    if (scope === 'fundraise') {
        const c = await queryOne('SELECT id, group_id, title, title_local FROM fundraise_campaigns WHERE id = :scopeId', { scopeId });
        if (!c) return null;
        const people = await query(
            `SELECT user_id FROM fundraise_members WHERE campaign_id = :scopeId
             UNION SELECT user_id FROM admin_group_members WHERE group_id = :groupId`,
            { scopeId, groupId: c.group_id },
        );
        return {
            scope,
            scopeId,
            groupId: c.group_id,
            campaignId: c.id,
            title: c.title,
            titleLocal: c.title_local,
            manage: (await fundraisePermissions(user, c)).manage,
            candidateIds: people.map((m) => m.user_id),
            link: `/fundraise/${c.id}?tab=details`,
        };
    }
    return null;
}

/** People who can be invited, with names, for the attendee picker. */
export async function candidatePeople(ids) {
    if (!ids.length) return [];
    const l = inList(ids, 'c');
    return query(
        `SELECT id, full_name, full_name_local FROM users_list WHERE id IN (${l.sql}) AND status = 'active' ORDER BY full_name`,
        l.params,
    );
}

/**
 * Meetings of one group (group meetings only — a fundraise's meetings live on the fundraise)
 * or one fundraise, with RSVP counts and the viewer's own answer.
 */
export async function listMeetings(scope, scopeId, viewerId) {
    const where = scope === 'group' ? 'e.group_id = :scopeId AND e.campaign_id IS NULL' : 'e.campaign_id = :scopeId';
    const rows = await query(
        `SELECT e.id, e.title, e.title_local, e.start_date, e.start_time, e.location, e.created_by,
                COUNT(a.user_id) AS invited,
                SUM(a.rsvp = 'yes') AS yes_n, SUM(a.rsvp = 'maybe') AS maybe_n, SUM(a.rsvp = 'no') AS no_n,
                MAX(CASE WHEN a.user_id = :viewerId THEN a.rsvp END) AS my_rsvp
           FROM events_list e
           LEFT JOIN events_attendees a ON a.event_id = e.id
          WHERE e.event_type = 'meeting' AND ${where}
          GROUP BY e.id, e.title, e.title_local, e.start_date, e.start_time, e.location, e.created_by
          ORDER BY e.start_date DESC, e.start_time DESC
          LIMIT 50`,
        { scopeId, viewerId },
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [meta, reminders, attendees] = await Promise.all([
        getMetaMany('events_list', ids, ['description']),
        (async () => {
            const l = inList(ids, 'r');
            return query(`SELECT event_id, offset_minutes FROM events_reminders WHERE event_id IN (${l.sql})`, l.params);
        })(),
        (async () => {
            const l = inList(ids, 'a');
            return query(
                `SELECT a.event_id, a.user_id, a.rsvp, u.full_name, u.full_name_local
                   FROM events_attendees a JOIN users_list u ON u.id = a.user_id
                  WHERE a.event_id IN (${l.sql}) ORDER BY u.full_name`,
                l.params,
            );
        })(),
    ]);
    return rows.map((r) => ({
        ...r,
        yes_n: Number(r.yes_n || 0),
        maybe_n: Number(r.maybe_n || 0),
        no_n: Number(r.no_n || 0),
        agenda: meta[r.id]?.description ?? '',
        reminders: reminders.filter((x) => x.event_id === r.id).map((x) => x.offset_minutes),
        attendees: attendees.filter((x) => x.event_id === r.id),
    }));
}

/** The soonest upcoming meeting of a group/fundraise, for the pinned banner. */
export async function nextMeetingOf(scope, scopeId, viewerId, today) {
    const all = await listMeetings(scope, scopeId, viewerId);
    return all.filter((m) => m.start_date >= today).sort((a, b) => (a.start_date + (a.start_time ?? '')).localeCompare(b.start_date + (b.start_time ?? '')))[0] ?? null;
}

/** Recompute reminder rows for a meeting (on create and on reschedule). */
export async function writeReminders(q, eventId, day, time, offsets) {
    await q('DELETE FROM events_reminders WHERE event_id = :eventId', { eventId });
    const start = `${day} ${time || DEFAULT_TIME}`;
    for (const off of offsets) {
        await q(
            `INSERT INTO events_reminders (event_id, offset_minutes, remind_at)
             VALUES (:eventId, :off, DATE_SUB(:start, INTERVAL :off MINUTE))`,
            { eventId, off, start },
        );
    }
}

/** Upcoming group meetings, for the Meetings tab badge. */
export async function upcomingMeetingCount(groupId, today) {
    const row = await queryOne(
        `SELECT COUNT(*) AS n FROM events_list
          WHERE event_type = 'meeting' AND group_id = :groupId AND campaign_id IS NULL AND start_date >= :today`,
        { groupId, today },
    );
    return row.n;
}
