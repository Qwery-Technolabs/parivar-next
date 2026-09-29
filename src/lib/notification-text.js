// Pure module — renders a stored notification in the READER's language.
import { date as fmtDate, time as fmtTime } from './format';

/**
 * @param {{ type: string, data: object|string|null }} n
 * @param {(key: string, vars?: object) => string} t
 * @param {string} locale
 */
export function notificationText(n, t, locale) {
    const d = typeof n.data === 'string' ? JSON.parse(n.data || '{}') : n.data || {};
    const vars = { ...d };
    // Optional parts carry their own separator, so a missing value leaves no dangling comma.
    vars.city = d.city ? `, ${d.city}` : '';
    vars.place = d.place ? ` · ${d.place}` : '';
    vars.time = d.time ? `, ${fmtTime(d.time)}` : '';
    if (d.date) vars.date = fmtDate(d.date, locale);
    if (d.role) {
        const key = `fundraise.teamRoles.${d.role}`;
        const label = t(key);
        vars.role = label === key ? d.role : label;
    }
    // Meeting reminders say when: "tomorrow", "in 1 hour", "in 15 minutes", "now".
    if (d.offset != null) {
        const key = `meetings.when.${d.offset}`;
        const label = t(key);
        vars.when = label === key ? '' : label;
    }
    if (locale === 'gu' && d.group_local) vars.group = d.group_local;
    if (locale === 'gu' && d.title_local) vars.title = d.title_local;
    // Dictionary keys use _ because translate() walks dotted paths ('blood.request' → blood_request).
    return t(`notifications.types.${n.type.replace('.', '_')}`, vars);
}
