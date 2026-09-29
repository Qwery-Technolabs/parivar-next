// The project's one timezone, chosen by an admin (admin_settings.timezone), default IST.
// It decides what "today" is (meeting dates, reminders, "Yesterday" labels) and the DB
// session time zone, so NOW() and DEFAULT CURRENT_TIMESTAMP record local time.
// Server-side state lives on globalThis so hot reloads and every module see one value.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Offered in Settings: India first, then where members' families commonly live. */
export const TIMEZONES = {
    'Asia/Kolkata': 'India — IST (UTC+05:30)',
    'Asia/Kathmandu': 'Nepal (UTC+05:45)',
    'Asia/Dubai': 'UAE / Gulf (UTC+04:00)',
    'Asia/Riyadh': 'Saudi Arabia / Kuwait (UTC+03:00)',
    'Asia/Singapore': 'Singapore / Malaysia (UTC+08:00)',
    'Africa/Nairobi': 'Kenya / East Africa (UTC+03:00)',
    'Europe/London': 'United Kingdom',
    'America/New_York': 'USA — Eastern',
    'America/Chicago': 'USA — Central',
    'America/Los_Angeles': 'USA — Pacific',
    'America/Toronto': 'Canada — Eastern',
    'Australia/Sydney': 'Australia — Sydney',
    'Pacific/Auckland': 'New Zealand',
};

export function isTimeZone(tz) {
    return Object.hasOwn(TIMEZONES, tz);
}

export function appTimeZone() {
    return globalThis.__parivarTz ?? DEFAULT_TIMEZONE;
}

/** Called when the admin setting is read or saved. Unknown values are ignored. */
export function setAppTimeZone(tz) {
    if (isTimeZone(tz)) globalThis.__parivarTz = tz;
}

/** '+05:30' style UTC offset of `tz` right now (DST-aware), for MySQL's SET time_zone. */
export function offsetOf(tz = appTimeZone(), at = new Date()) {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value;
    // "GMT+05:30", "GMT-04:00", or plain "GMT" for UTC itself.
    const m = /GMT([+-]\d{2}:\d{2})/.exec(part ?? '');
    return m ? m[1] : '+00:00';
}

/** Today in the project timezone as YYYY-MM-DD (the server itself may run in UTC). */
export function todayLocal(tz = appTimeZone()) {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
