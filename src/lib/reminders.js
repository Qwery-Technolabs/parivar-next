import 'server-only';
import { query, withTransaction } from './db';
import { after } from 'next/server';
import { syncEveryoneMeetings } from './meetings';
import { notifyMany } from './notifications';

/** A reminder this late (server was down, meeting created at the last minute) is dropped, not sent. */
const STALE_HOURS = 6;
const BATCH = 50;

/**
 * Send every reminder that is due. Safe to call from several places at once (the in-process
 * loop and the cron URL): rows are claimed with FOR UPDATE SKIP LOCKED and marked sent inside
 * the same transaction, so each reminder goes out exactly once.
 * @returns {Promise<{ sent: number, skipped: number }>}
 */
export async function processDueReminders() {
    const claimed = await withTransaction(async (q) => {
        const rows = await q(
            `SELECT r.id, r.event_id, r.offset_minutes, (r.remind_at < DATE_SUB(NOW(), INTERVAL ${STALE_HOURS} HOUR)) AS stale
               FROM events_reminders r
              WHERE r.sent_at IS NULL AND r.remind_at <= NOW()
              ORDER BY r.remind_at
              LIMIT ${BATCH}
              FOR UPDATE SKIP LOCKED`,
        );
        for (const r of rows) await q('UPDATE events_reminders SET sent_at = NOW() WHERE id = :id', { id: r.id });
        return rows;
    });

    // Anyone who joined the group since gets this reminder too (upcoming "Everyone" meetings).
    if (claimed.length) await syncEveryoneMeetings({ eventIds: [...new Set(claimed.map((r) => r.event_id))] });

    let sent = 0;
    let skipped = 0;
    for (const r of claimed) {
        if (r.stale) {
            skipped++;
            continue;
        }
        const [event] = await query(
            `SELECT id, title, title_local, start_date, start_time, location, group_id, campaign_id
               FROM events_list WHERE id = :id`,
            { id: r.event_id },
        );
        if (!event) continue;
        // Everyone invited except those who already said they are not coming.
        const people = await query("SELECT user_id FROM events_attendees WHERE event_id = :id AND rsvp <> 'no'", { id: event.id });
        await notifyMany(
            people.map((p) => p.user_id),
            {
                type: 'meeting.reminder',
                data: {
                    title: event.title,
                    title_local: event.title_local,
                    date: event.start_date,
                    time: event.start_time,
                    place: event.location,
                    offset: r.offset_minutes,
                },
                link: event.campaign_id ? `/fundraise/${event.campaign_id}?tab=meetings` : `/groups/${event.group_id}?tab=meetings`,
            },
        );
        sent++;
    }
    return { sent, skipped };
}

/**
 * Serverless (Vercel) has no timer and the Hobby plan's cron runs once a day, so reminders also
 * ride along on normal traffic: after a signed-in page is sent, check for due ones — at most
 * once a minute per instance (processDueReminders is safe to run twice). No-op off Vercel,
 * where the loop below does the job.
 */
export function kickReminders() {
    if (!process.env.VERCEL) return;
    const now = Date.now();
    if (globalThis.__pvReminderKick && now - globalThis.__pvReminderKick < 60 * 1000) return;
    globalThis.__pvReminderKick = now;
    after(() => processDueReminders().catch((err) => console.error('reminders failed', err.message)));
}

/** Run processDueReminders every minute inside this Node server process. Idempotent. */
export function startReminderLoop() {
    if (globalThis.__pvReminderLoop) return;
    const tick = () => processDueReminders().catch((err) => console.error('reminders failed', err.message));
    globalThis.__pvReminderLoop = setInterval(tick, 60 * 1000);
    setTimeout(tick, 5000); // shortly after start, so a restart does not delay due reminders by a minute
}
