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
        const c = await queryOne('SELECT id, group_id, kind, title, title_local FROM fundraise_campaigns WHERE id = :scopeId', { scopeId });
        if (!c) return null;
        const people = await query(FUNDRAISE_PEOPLE, { scopeId });
        return {
            scope,
            scopeId,
            groupId: c.group_id,
            campaignId: c.id,
            title: c.title,
            titleLocal: c.title_local,
            manage: (await fundraisePermissions(user, c)).manage,
            candidateIds: people.map((m) => m.user_id),
            link: `/fundraise/${c.id}?tab=meetings`,
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
    // People who joined since: add them to upcoming "Everyone" meetings before listing.
    await syncEveryoneMeetings({ scope, scopeId });
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
        getMetaMany('events_list', ids, ['description', 'audience']),
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
        audience: meta[r.id]?.audience ?? null, // 'all' | 'selected' (null = saved before this was kept)
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

/**
 * Birthdays of the people of one group (with their group role) or one fundraise (team members
 * with their team role; members of its groups as 'group_member'), for the meeting calendar.
 * Month/day only — the calendar places them in whichever month is showing.
 * @returns {Promise<Array<{ id: number, name: string, nameLocal: string|null, month: number, day: number, born: number, role: string }>>}
 */
export async function scopeBirthdays(scope, scopeId) {
    const cols = 'u.id, u.full_name, u.full_name_local, MONTH(u.dob) AS m, DAY(u.dob) AS d, YEAR(u.dob) AS born';
    const alive = "u.status = 'active' AND u.dob IS NOT NULL";
    let rows;
    if (scope === 'group') {
        rows = await query(
            `SELECT ${cols}, gm.member_role AS role FROM admin_group_members gm JOIN users_list u ON u.id = gm.user_id
              WHERE gm.group_id = :scopeId AND ${alive}`,
            { scopeId },
        );
    } else {
        const [team, members] = await Promise.all([
            query(`SELECT ${cols}, fm.member_role AS role FROM fundraise_members fm JOIN users_list u ON u.id = fm.user_id WHERE fm.campaign_id = :scopeId AND ${alive}`, { scopeId }),
            query(
                `SELECT DISTINCT ${cols}, 'group_member' AS role FROM fundraise_groups fg
                   JOIN admin_group_members gm ON gm.group_id = fg.group_id JOIN users_list u ON u.id = gm.user_id
                  WHERE fg.campaign_id = :scopeId AND ${alive}`,
                { scopeId },
            ),
        ]);
        // A team role says more than "in one of its groups".
        const byId = new Map(members.map((r) => [r.id, r]));
        for (const r of team) byId.set(r.id, r);
        rows = [...byId.values()];
    }
    return rows.map((r) => ({ id: r.id, name: r.full_name, nameLocal: r.full_name_local, month: r.m, day: r.d, born: r.born, role: r.role }));
}

/**
 * Who a fundraise's meeting can invite: its team + the members of its groups; for a Mandal, its
 * own members (fundraise_subscribers).
 */
const FUNDRAISE_PEOPLE = `
    SELECT s.user_id FROM fundraise_subscribers s JOIN fundraise_campaigns c ON c.id = s.campaign_id AND c.kind = 'mandal'
     WHERE s.campaign_id = :scopeId
    UNION SELECT fm.user_id FROM fundraise_members fm JOIN fundraise_campaigns c ON c.id = fm.campaign_id AND c.kind <> 'mandal'
     WHERE fm.campaign_id = :scopeId
    UNION SELECT gm.user_id FROM admin_group_members gm JOIN fundraise_groups fg ON fg.group_id = gm.group_id
      JOIN fundraise_campaigns c ON c.id = fg.campaign_id AND c.kind <> 'mandal'
     WHERE fg.campaign_id = :scopeId`;

/** Everyone a group / fundraise meeting can invite right now (same as meetingScope's candidates). */
async function scopeCandidateIds(scope, scopeId) {
    const rows =
        scope === 'group'
            ? await query('SELECT user_id FROM admin_group_members WHERE group_id = :scopeId', { scopeId })
            : await query(FUNDRAISE_PEOPLE, { scopeId });
    return rows.map((r) => r.user_id);
}

/**
 * "Everyone" means everyone — also people who join later: for upcoming meetings saved with
 * audience = 'all' (events_listmeta), invite anyone now in the group / fundraise who is not on
 * the list yet. Runs when a meeting list opens and before reminders go out. Past meetings and
 * "chosen people" meetings are left as they are.
 * @param {{ scope?: 'group'|'fundraise', scopeId?: number, eventIds?: number[] }} where
 */
export async function syncEveryoneMeetings({ scope, scopeId, eventIds } = {}) {
    let events;
    if (eventIds?.length) {
        const l = inList(eventIds, 'ev');
        events = await query(
            `SELECT e.id, e.group_id, e.campaign_id FROM events_list e
               JOIN events_listmeta m ON m.event_id = e.id AND m.meta_key = 'audience' AND m.meta_value = 'all'
              WHERE e.event_type = 'meeting' AND e.start_date >= CURDATE() AND e.id IN (${l.sql})`,
            l.params,
        );
    } else if (scope && scopeId) {
        events = await query(
            `SELECT e.id, e.group_id, e.campaign_id FROM events_list e
               JOIN events_listmeta m ON m.event_id = e.id AND m.meta_key = 'audience' AND m.meta_value = 'all'
              WHERE e.event_type = 'meeting' AND e.start_date >= CURDATE()
                AND ${scope === 'group' ? 'e.group_id = :scopeId AND e.campaign_id IS NULL' : 'e.campaign_id = :scopeId'}`,
            { scopeId },
        );
    } else return 0;
    let added = 0;
    for (const e of events) {
        const ids = e.campaign_id ? await scopeCandidateIds('fundraise', e.campaign_id) : await scopeCandidateIds('group', e.group_id);
        for (const uid of ids) {
            const r = await query('INSERT IGNORE INTO events_attendees (event_id, user_id) VALUES (:id, :uid)', { id: e.id, uid });
            added += r?.affectedRows ?? 0;
        }
    }
    return added;
}
