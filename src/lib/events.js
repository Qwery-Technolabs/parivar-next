import 'server-only';
import { getMetaMany, query } from './db';
import { todayIST } from './forms';

export const EVENT_TYPES = ['event', 'fundraise', 'meeting', 'festival', 'other'];

const pad = (n) => String(n).padStart(2, '0');

/**
 * `?m=YYYY-MM` → the month to show. Unknown or out-of-range → current IST month,
 * and `isDefault` tells the caller to drop the param (one view, one URL).
 */
export function resolveMonth(sp = {}) {
    const raw = String((Array.isArray(sp.m) ? sp.m[0] : sp.m) ?? '');
    const today = todayIST();
    const [ty, tm] = today.split('-').map(Number);
    let year = ty;
    let month = tm;
    const match = /^(\d{4})-(\d{2})$/.exec(raw);
    if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]);
        if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
            year = y;
            month = m;
        }
    }
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
    const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
    const key = `${year}-${pad(month)}`;
    return {
        year,
        month,
        key,
        days,
        first: `${key}-01`,
        last: `${key}-${pad(days)}`,
        firstWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), // 0 = Sunday
        prev,
        next,
        today,
        currentKey: today.slice(0, 7),
    };
}

/** Events and fundraise windows overlapping [first, last]. */
export async function listMonth(first, last) {
    const [events, campaigns] = await Promise.all([
        query(
            `SELECT e.id, e.title, e.title_local, e.event_type, e.start_date, e.end_date, e.start_time, e.location,
                    e.group_id, e.campaign_id, g.name AS group_name, g.name_local AS group_name_local
               FROM events_list e LEFT JOIN admin_groups g ON g.id = e.group_id
              WHERE e.start_date <= :last AND COALESCE(e.end_date, e.start_date) >= :first
              ORDER BY e.start_date, e.start_time IS NULL, e.start_time, e.id`,
            { first, last },
        ),
        // Read straight from fundraise_campaigns so a fundraise's dates have one source of truth.
        query(
            `SELECT id, title, title_local, start_date, end_date, status
               FROM fundraise_campaigns
              WHERE status <> 'draft' AND start_date IS NOT NULL
                AND start_date <= :last AND COALESCE(end_date, start_date) >= :first
              ORDER BY start_date, id`,
            { first, last },
        ),
    ]);
    const meta = await getMetaMany('events_list', events.map((e) => e.id), ['description']);
    return {
        events: events.map((e) => ({ ...e, description: meta[e.id]?.description ?? '' })),
        campaigns,
    };
}

export async function listGroupOptions() {
    return query(`SELECT id, name, name_local FROM admin_groups WHERE status = 'active' ORDER BY name`);
}
