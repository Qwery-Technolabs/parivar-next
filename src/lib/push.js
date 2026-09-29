import 'server-only';
import { createHash } from 'node:crypto';
import webpush from 'web-push';
import { inList, query } from './db';
import { translate } from './i18n/config';
import en from './i18n/dictionaries/en';
import gu from './i18n/dictionaries/gu';
import { notificationText } from './notification-text';

const DICTS = { en, gu };

let configured = null;
/** Web Push is optional: without VAPID keys in the environment, pushes are skipped quietly. */
function ready() {
    if (configured !== null) return configured;
    const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
    configured = Boolean(pub && priv);
    if (configured) webpush.setVapidDetails(subject || 'mailto:admin@example.com', pub, priv);
    return configured;
}

export function vapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
}

export const endpointHash = (endpoint) => createHash('sha256').update(endpoint).digest('hex');

/**
 * Push one notification to every browser the given users enabled. Text is rendered per
 * recipient in THEIR language, from the same dictionary templates the bell uses. Never
 * throws; subscriptions the push service reports as gone (404/410) are deleted.
 * @param {number[]} userIds
 * @param {{ type: string, data?: object, link?: string|null }} n
 */
export async function pushToUsers(userIds, n) {
    if (!userIds.length || !ready()) return 0;
    try {
        const l = inList(userIds, 'u');
        const subs = await query(
            `SELECT s.id, s.endpoint, s.p256dh, s.auth, u.language
               FROM users_push_subscriptions s JOIN users_list u ON u.id = s.user_id
              WHERE s.user_id IN (${l.sql})`,
            l.params,
        );
        let sent = 0;
        await Promise.all(
            subs.map(async (s) => {
                const dict = DICTS[s.language] ?? gu;
                const t = (key, vars) => translate(dict, key, vars);
                // Title = where it came from (the fundraise / group / meeting, in the reader's
                // language), else the app. The icon is the Samaj logo (see public/sw.js).
                const d = n.data ?? {};
                const local = s.language !== 'en';
                const source = (local && d.title_local) || d.title || (local && d.group_local) || d.group || '';
                const payload = JSON.stringify({
                    title: source || t('app.name'),
                    body: notificationText(n, t, s.language),
                    link: n.link || '/notifications',
                    tag: `${n.type}:${n.link ?? ''}`, // same thing twice replaces, not stacks
                });
                try {
                    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
                        TTL: 60 * 60 * 12,
                    });
                    sent++;
                    await query('UPDATE users_push_subscriptions SET last_used_at = NOW() WHERE id = :id', { id: s.id });
                } catch (err) {
                    // Gone: the person revoked permission or cleared the browser — stop trying.
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        await query('DELETE FROM users_push_subscriptions WHERE id = :id', { id: s.id });
                    } else {
                        console.error('push failed', err.statusCode, err.body?.slice?.(0, 120));
                    }
                }
            }),
        );
        return sent;
    } catch (err) {
        console.error('push batch failed', err.message);
        return 0;
    }
}
