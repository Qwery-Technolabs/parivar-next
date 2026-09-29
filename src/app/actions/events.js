'use server';
import { refresh } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { EVENT_TYPES } from '@/lib/events';
import { notifyMany } from '@/lib/notifications';
import { getSetting } from '@/lib/settings';
import { date, id, oneOf, str, time } from '@/lib/forms';
import { canManageEvents } from '@/lib/roles';

/** Create (no id) or update (id) an event. */
export async function saveEvent(prev, fd) {
    const user = await getCurrentUser();
    if (!user || !canManageEvents(user.role)) return { error: 'common.forbidden' };

    const eventId = id(fd, 'id');
    const title = str(fd, 'title', 200);
    const startDate = date(fd, 'start_date');
    const endRaw = str(fd, 'end_date');
    const endDate = endRaw ? date(fd, 'end_date') : null;
    const timeRaw = str(fd, 'start_time');
    const startTime = timeRaw ? time(fd, 'start_time') : null;
    const groupId = id(fd, 'group_id');

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'common.required';
    if (!startDate) fieldErrors.start_date = 'common.required';
    if (endRaw && !endDate) fieldErrors.end_date = 'calendar.errors.date';
    else if (endDate && startDate && endDate < startDate) fieldErrors.end_date = 'calendar.errors.endBeforeStart';
    if (timeRaw && !startTime) fieldErrors.start_time = 'calendar.errors.time';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    if (groupId && !(await queryOne('SELECT id FROM admin_groups WHERE id = :groupId', { groupId })))
        return { fieldErrors: { group_id: 'common.error' } };

    const values = {
        title,
        titleGu: str(fd, 'title_gu', 200) || null,
        type: oneOf(fd, 'event_type', EVENT_TYPES, 'event'),
        startDate,
        // An end equal to the start is a one-day event; store NULL so there is one representation.
        endDate: endDate && endDate !== startDate ? endDate : null,
        startTime,
        location: str(fd, 'location', 200) || null,
        groupId,
    };

    const savedId = await withTransaction(async (q) => {
        let rowId = eventId;
        if (eventId) {
            const r = await q(
                `UPDATE events_list SET title = :title, title_gu = :titleGu, event_type = :type, start_date = :startDate,
                        end_date = :endDate, start_time = :startTime, location = :location, group_id = :groupId
                  WHERE id = :id`,
                { ...values, id: eventId },
            );
            if (r.affectedRows === 0) return null;
        } else {
            const r = await q(
                `INSERT INTO events_list (title, title_gu, event_type, start_date, end_date, start_time, location, group_id, created_by)
                 VALUES (:title, :titleGu, :type, :startDate, :endDate, :startTime, :location, :groupId, :by)`,
                { ...values, by: user.id },
            );
            rowId = r.insertId;
        }
        await setMeta('events_list', rowId, { description: str(fd, 'description', 5000) }, q);
        return rowId;
    });
    if (!savedId) return { error: 'common.error' };

    await audit(user.id, eventId ? 'event.update' : 'event.create', 'event', savedId, { title, start_date: startDate });
    if (!eventId && (await getSetting('events', 'notify_new_event'))) {
        // A group event goes to that group; an event with no group is for the whole parivar.
        const audience = groupId
            ? await query('SELECT user_id AS id FROM admin_group_members WHERE group_id = :groupId', { groupId })
            : await query("SELECT id FROM users_list WHERE status = 'active' AND password_hash IS NOT NULL");
        await notifyMany(
            audience.map((r) => r.id),
            {
                type: 'event.new',
                data: { title, title_gu: values.titleGu, date: startDate },
                link: `/calendar?m=${startDate.slice(0, 7)}`,
                actorId: user.id,
            },
        );
    }
    refresh();
    return { ok: true, message: 'calendar.created' };
}

export async function deleteEvent(prev, fd) {
    const user = await getCurrentUser();
    const eventId = id(fd, 'id');
    if (!user || !canManageEvents(user.role) || !eventId) return { error: 'common.forbidden' };
    const ev = await queryOne('SELECT title FROM events_list WHERE id = :eventId', { eventId });
    if (!ev) return { error: 'common.error' };
    await query('DELETE FROM events_list WHERE id = :eventId', { eventId }); // meta cascades
    await audit(user.id, 'event.delete', 'event', eventId, { title: ev.title });
    refresh();
    return { ok: true, message: 'common.deleted' };
}
