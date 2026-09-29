// Pure module — client and server. Notification categories a person can switch off in
// Settings → Notifications. A notification's category comes from its type's first part
// (blood.request → blood). Stored as users_listmeta.notify_off: a comma list of categories.

export const NOTIFY_CATEGORIES = ['blood', 'calendar', 'meetings', 'fundraise', 'groups', 'discussion', 'members'];

const BY_PREFIX = {
    blood: 'blood',
    event: 'calendar',
    meeting: 'meetings',
    fundraise: 'fundraise',
    group: 'groups',
    chat: 'discussion',
    member: 'members',
};

/** The category of a notification type, or null (never filtered, e.g. push.test). */
export function categoryOf(type) {
    return BY_PREFIX[String(type).split('.')[0]] ?? null;
}

/** The categories someone has switched off, from their meta value. */
export function parseOff(value) {
    return String(value ?? '')
        .split(',')
        .filter((c) => NOTIFY_CATEGORIES.includes(c));
}
