import 'server-only';
import { fundraisePermissions, isLeaderOfFundraiseGroup } from './access';
import { getMetaMany, inList, query } from './db';

// Mandal (savings circle) — a fundraise of kind 'mandal' inside a group. Its members
// (fundraise_subscribers) pay a fixed amount at its meetings (the fundraise's own meetings).
// Per meeting (events_listmeta): collect '1' | '0' (default '1') and installment (default: the
// Mandal's, fundraise_campaignsmeta.installment). Per meeting and member
// (fundraise_mandal_marks): present, paid, and the fundraise_contributions row of that payment —
// so totals, the ledger and print include Mandal money. Dues = installments of the collecting
// meetings held since they joined − what they paid; missed = absent marks since they last came.

/**
 * May `user` run this Mandal (add / remove members, mark attendance and payments)? Admins and
 * sub-admins (app-level, the fundraise's admins, admins / sub-admins of its groups) and its
 * Treasurer and Collector — not plain members.
 */
export async function canRunMandal(user, campaign) {
    if (!user || !campaign) return false;
    const perms = await fundraisePermissions(user, campaign);
    if (perms.manage || perms.teamRole === 'treasurer' || perms.teamRole === 'collector') return true;
    return isLeaderOfFundraiseGroup(user.id, campaign.id);
}

/**
 * The Mandal's meetings, newest first, with whether money is collected and how much, and who it is
 * for: everyone (audience 'all', or older meetings without one) or the chosen members (`invited`).
 */
export async function mandalMeetings(campaignId, defaultInstallment) {
    const rows = await query(
        `SELECT id, title, title_local, start_date, start_time, location FROM events_list
          WHERE event_type = 'meeting' AND campaign_id = :campaignId ORDER BY start_date DESC, start_time DESC LIMIT 100`,
        { campaignId },
    );
    const meta = await getMetaMany('events_list', rows.map((r) => r.id), ['collect', 'installment', 'audience']);
    const chosen = rows.filter((r) => meta[r.id]?.audience === 'selected').map((r) => r.id);
    const att = chosen.length
        ? await (async () => {
              const l = inList(chosen, 'ev');
              return query(`SELECT event_id, user_id FROM events_attendees WHERE event_id IN (${l.sql})`, l.params);
          })()
        : [];
    return rows.map((r) => ({
        ...r,
        everyone: meta[r.id]?.audience !== 'selected',
        invited: att.filter((a) => a.event_id === r.id).map((a) => a.user_id),
        collect: (meta[r.id]?.collect ?? '1') === '1',
        installment: Number(meta[r.id]?.installment ?? defaultInstallment ?? 0) || 0,
    }));
}

/**
 * Members with what they owe and how long they have been away.
 * @returns {Promise<Array<{ id, full_name, full_name_local, phone, joined, due: number, paid: number, missed: number, daysAway: number|null, lastPresent: string|null }>>}
 */
export async function mandalMembers(campaignId, meetings, today) {
    const members = await query(
        `SELECT u.id, u.full_name, u.full_name_local, u.phone, DATE(s.created_at) AS joined
           FROM fundraise_subscribers s JOIN users_list u ON u.id = s.user_id
          WHERE s.campaign_id = :campaignId ORDER BY u.full_name`,
        { campaignId },
    );
    if (!members.length) return [];
    const marks = await query('SELECT event_id, user_id, present, paid FROM fundraise_mandal_marks WHERE campaign_id = :campaignId', { campaignId });
    const held = meetings.filter((m) => m.start_date <= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const day = (d) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
    return members.map((m) => {
        const mine = new Map(marks.filter((x) => x.user_id === m.id).map((x) => [x.event_id, x]));
        // Count from the meeting they joined at (or the first meeting, if they joined before it) —
        // only meetings they were asked to (everyone, or chosen), or ones they were marked at.
        const theirs = held.filter((e) => (e.start_date >= m.joined && isFor(e, m.id)) || mine.has(e.id));
        const owed = theirs.filter((e) => e.collect).reduce((s, e) => s + e.installment, 0);
        const paid = [...mine.values()].reduce((s, x) => s + Number(x.paid || 0), 0);
        // Missed in a row: marked meetings since the last one they came to (unmarked ones are unknown).
        let missed = 0;
        let lastPresent = null;
        for (const e of [...theirs].reverse()) {
            const mk = mine.get(e.id);
            if (!mk) continue;
            if (mk.present) {
                lastPresent = e.start_date;
                break;
            }
            missed++;
        }
        return {
            ...m,
            due: Math.max(0, Math.round((owed - paid) * 100) / 100),
            paid,
            missed,
            lastPresent,
            daysAway: missed ? day(lastPresent ?? theirs[0]?.start_date ?? m.joined) : null,
        };
    });
}

/** Is this meeting for this member: everyone's, or they were chosen? */
export function isFor(meeting, userId) {
    return meeting.everyone || meeting.invited.includes(userId);
}

/** Marks of one meeting: user_id → { present, paid }. */
export async function meetingMarks(eventId) {
    const rows = await query('SELECT user_id, present, paid FROM fundraise_mandal_marks WHERE event_id = :eventId', { eventId });
    return Object.fromEntries(rows.map((r) => [r.user_id, { present: Boolean(r.present), paid: r.paid == null ? null : Number(r.paid) }]));
}

/** Pending for each member BEFORE this meeting (what they still owe from earlier ones). */
export function pendingBefore(members, meetings, marksByMeeting, eventId) {
    const target = meetings.find((m) => m.id === eventId);
    if (!target) return {};
    const earlier = meetings.filter((m) => m.collect && m.start_date < target.start_date);
    const out = {};
    for (const mem of members) {
        const owed = earlier
            .filter((e) => (e.start_date >= mem.joined && isFor(e, mem.id)) || marksByMeeting[e.id]?.[mem.id])
            .reduce((s, e) => s + e.installment, 0);
        const paid = earlier.reduce((s, e) => s + Number(marksByMeeting[e.id]?.[mem.id]?.paid || 0), 0);
        out[mem.id] = Math.max(0, Math.round((owed - paid) * 100) / 100);
    }
    return out;
}

/** All marks of a Mandal, by meeting: eventId → userId → { present, paid, mode } (mode of the payment's contribution). */
export async function allMarks(campaignId) {
    const rows = await query(
        `SELECT m.event_id, m.user_id, m.present, m.paid, fc.mode
           FROM fundraise_mandal_marks m LEFT JOIN fundraise_contributions fc ON fc.id = m.contribution_id AND fc.deleted_at IS NULL
          WHERE m.campaign_id = :campaignId`,
        { campaignId },
    );
    const out = {};
    for (const r of rows)
        (out[r.event_id] ??= {})[r.user_id] = { present: Boolean(r.present), paid: r.paid == null ? null : Number(r.paid), mode: r.mode ?? null };
    return out;
}

/** Ids of members, for pickers. */
export async function subscriberIds(campaignId) {
    const l = inList([campaignId], 's');
    return (await query(`SELECT user_id FROM fundraise_subscribers WHERE campaign_id IN (${l.sql})`, l.params)).map((r) => r.user_id);
}
