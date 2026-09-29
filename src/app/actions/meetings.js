'use server';
import { refresh } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { date, str, strOrNull, time, todayIST } from '@/lib/forms';
import { meetingScope, REMINDER_OFFSETS, writeReminders } from '@/lib/meetings';
import { notifyMany } from '@/lib/notifications';

const FORBIDDEN = { error: 'common.forbidden' };
const SCOPES = ['group', 'fundraise'];

function readScope(fd) {
    const scope = String(fd.get('scope') ?? '');
    const scopeId = Number(fd.get('scope_id')) || 0;
    return SCOPES.includes(scope) && scopeId ? { scope, scopeId } : null;
}

/**
 * Schedule or edit a meeting of a group or a fundraise.
 * Fields: scope, scope_id, meeting_id?, title, start_date, start_time, location, agenda,
 *         invite ('all' | 'selected'), attendee_ids[] (when selected), reminders[] (minutes).
 */
export async function saveMeeting(prev, fd) {
    const user = await getCurrentUser();
    const where = readScope(fd);
    if (!user || !where) return FORBIDDEN;
    const ctx = await meetingScope(user, where.scope, where.scopeId);
    if (!ctx || !ctx.manage) return FORBIDDEN;

    const meetingId = Number(fd.get('meeting_id')) || null;
    const day = date(fd, 'start_date');
    const rawTime = str(fd, 'start_time', 8);
    const at = rawTime ? time(fd, 'start_time') : null;
    const fieldErrors = {};
    if (!day) fieldErrors.start_date = 'meetings.errors.date';
    else if (!meetingId && day < todayIST()) fieldErrors.start_date = 'meetings.errors.past';
    if (rawTime && !at) fieldErrors.start_time = 'meetings.errors.time';

    // Who needs to come: everyone in the group/fundraise, or a chosen subset of them.
    const candidates = new Set(ctx.candidateIds);
    const invite = fd.get('invite') === 'selected' ? 'selected' : 'all';
    const chosen = invite === 'all' ? [...candidates] : [...new Set(fd.getAll('attendee_ids').map(Number))].filter((i) => candidates.has(i));
    if (chosen.length === 0) fieldErrors.attendee_ids = 'meetings.errors.attendees';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const reminders = [...new Set(fd.getAll('reminders').map(Number))].filter((m) => REMINDER_OFFSETS.includes(m));
    const title = str(fd, 'title', 200) || `${ctx.title} — Meeting`.slice(0, 200);
    const titleLocal = strOrNull(fd, 'title_local', 200);
    const place = strOrNull(fd, 'location', 200);
    const agenda = str(fd, 'agenda', 20000);

    let existing = null;
    if (meetingId) {
        existing = await queryOne(
            `SELECT id, start_date, start_time, location FROM events_list
              WHERE id = :meetingId AND event_type = 'meeting' AND ${where.scope === 'group' ? 'group_id = :sid AND campaign_id IS NULL' : 'campaign_id = :sid'}`,
            { meetingId, sid: where.scopeId },
        );
        if (!existing) return FORBIDDEN;
    }
    const before = existing
        ? new Set((await query('SELECT user_id FROM events_attendees WHERE event_id = :id', { id: meetingId })).map((r) => r.user_id))
        : new Set();

    const eventId = await withTransaction(async (q) => {
        let id = meetingId;
        if (id) {
            await q(
                `UPDATE events_list SET title = :title, title_local = :titleLocal, start_date = :day, start_time = :at, location = :place
                  WHERE id = :id`,
                { title, titleLocal, day, at, place, id },
            );
        } else {
            const r = await q(
                `INSERT INTO events_list (title, title_local, event_type, start_date, start_time, location, group_id, campaign_id, created_by)
                 VALUES (:title, :titleLocal, 'meeting', :day, :at, :place, :groupId, :campaignId, :by)`,
                { title, titleLocal, day, at, place, groupId: ctx.groupId, campaignId: ctx.campaignId, by: user.id },
            );
            id = r.insertId;
        }
        await setMeta('events_list', id, { description: agenda }, q);
        // Keep the RSVPs of people who stay invited; add the new ones; drop the removed.
        for (const uid of chosen) {
            await q('INSERT IGNORE INTO events_attendees (event_id, user_id) VALUES (:id, :uid)', { id, uid });
        }
        const keep = new Set(chosen);
        for (const uid of before) {
            if (!keep.has(uid)) await q('DELETE FROM events_attendees WHERE event_id = :id AND user_id = :uid', { id, uid });
        }
        await writeReminders(q, id, day, at, reminders);
        return id;
    });

    const data = { title, title_local: titleLocal, date: day, time: at, place };
    const added = chosen.filter((uid) => !before.has(uid));
    const stayed = chosen.filter((uid) => before.has(uid));
    // "Changed" only when something people act on moved: the day, the time or the place.
    const moved =
        existing &&
        (existing.start_date !== day || (existing.start_time ?? null) !== at || (existing.location ?? null) !== place);
    await notifyMany(added, { type: 'meeting.invite', data, link: ctx.link, actorId: user.id });
    if (moved) {
        // Only people already invited hear "changed"; the newly added got an invitation above.
        await notifyMany(stayed, { type: 'meeting.updated', data, link: ctx.link, actorId: user.id });
    }
    await audit(user.id, meetingId ? 'meeting.update' : 'meeting.create', where.scope === 'group' ? 'group' : 'fundraise', where.scopeId, {
        event: eventId,
        date: day,
        invited: chosen.length,
    });
    refresh();
    return { ok: true, message: meetingId ? 'meetings.updated' : 'meetings.scheduled' };
}

/** Cancel (delete) a meeting. Attendees and reminders go with it; minutes stay as updates. */
export async function cancelMeeting(scope, scopeId, meetingId) {
    const user = await getCurrentUser();
    if (!user || !SCOPES.includes(scope)) return FORBIDDEN;
    const ctx = await meetingScope(user, scope, Number(scopeId));
    if (!ctx || !ctx.manage) return FORBIDDEN;
    const m = await queryOne(
        `SELECT id, title, title_local, start_date, start_time FROM events_list
          WHERE id = :id AND event_type = 'meeting' AND ${scope === 'group' ? 'group_id = :sid AND campaign_id IS NULL' : 'campaign_id = :sid'}`,
        { id: Number(meetingId), sid: Number(scopeId) },
    );
    if (!m) return FORBIDDEN;
    const invited = (await query('SELECT user_id FROM events_attendees WHERE event_id = :id', { id: m.id })).map((r) => r.user_id);
    await query('DELETE FROM events_list WHERE id = :id', { id: m.id });
    await notifyMany(invited, {
        type: 'meeting.cancelled',
        data: { title: m.title, title_local: m.title_local, date: m.start_date, time: m.start_time },
        link: ctx.link,
        actorId: user.id,
    });
    await audit(user.id, 'meeting.cancel', scope === 'group' ? 'group' : 'fundraise', Number(scopeId), { event: m.id });
    refresh();
    return { ok: true, message: 'meetings.cancelled' };
}

/** An invitee answers: coming / maybe / not coming. Only people who were invited can. */
export async function setRsvp(meetingId, rsvp) {
    const user = await getCurrentUser();
    if (!user || !['yes', 'maybe', 'no'].includes(rsvp)) return FORBIDDEN;
    const r = await query(
        'UPDATE events_attendees SET rsvp = :rsvp, responded_at = NOW() WHERE event_id = :id AND user_id = :uid',
        { rsvp, id: Number(meetingId), uid: user.id },
    );
    if (!r.affectedRows) return FORBIDDEN;
    refresh();
    return { ok: true };
}
