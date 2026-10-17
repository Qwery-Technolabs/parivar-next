import 'server-only';
import { createHash } from 'node:crypto';
import webpush from 'web-push';
import { inList, query } from './db';
import { translate } from './i18n/config';
import en from './i18n/dictionaries/en';
import gu from './i18n/dictionaries/gu';
import { notificationText } from './notification-text';
import { getSettings, samajName } from './settings';

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

// Sends at once (open sockets to the push service); a village-wide notice goes out in waves of this size.
const WAVE = 50;

/**
 * Send one payload per subscription row (payloadOf(row) → object); returns how many got through. Database work is
 * batched: ONE "last notification" update for every delivered token and ONE delete for the gone ones (404/410 —
 * permission revoked, browser cleared), never a statement per device.
 */
async function deliver(subs, payloadOf) {
    const ok = [];
    const gone = [];
    for (let i = 0; i < subs.length; i += WAVE) {
        await Promise.all(
            subs.slice(i, i + WAVE).map(async (s) => {
                try {
                    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payloadOf(s)), {
                        TTL: 60 * 60 * 12,
                        urgency: 'normal',
                        timeout: 10000,
                    });
                    ok.push(s.id);
                } catch (err) {
                    if (err.statusCode === 404 || err.statusCode === 410) gone.push(s.id);
                    else console.error('push failed', err.statusCode, err.body?.slice?.(0, 120));
                }
            }),
        );
    }
    if (ok.length) {
        const l = inList(ok, 'ok');
        await query(`UPDATE users_push_subscriptions SET last_used_at = NOW() WHERE id IN (${l.sql})`, l.params);
    }
    if (gone.length) {
        const l = inList(gone, 'gone');
        await query(`DELETE FROM users_push_subscriptions WHERE id IN (${l.sql})`, l.params);
    }
    return ok.length;
}

/** The Samaj logo for a notification: the big icon, and the small monochrome badge (Android's status bar). */
function samajIcons(general) {
    const v = general.logo_version ? `&v=${general.logo_version}` : '';
    return { icon: `/api/app-icon?size=192${v}`, badge: `/api/app-icon?badge=1${v}` };
}

async function subscriptionsOf(userIds) {
    const l = inList(userIds, 'u');
    return query(
        `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth, u.language
           FROM users_push_subscriptions s JOIN users_list u ON u.id = s.user_id
          WHERE s.user_id IN (${l.sql})`,
        l.params,
    );
}

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
        const subs = await subscriptionsOf(userIds);
        if (!subs.length) return 0;
        const general = await getSettings('admin').catch(() => ({}));
        const icons = samajIcons(general);
        return await deliver(subs, (s) => {
            const dict = DICTS[s.language] ?? gu;
            const t = (key, vars) => translate(dict, key, vars);
            // Title = where it came from (the fundraise / group / meeting, in the reader's
            // language), else the app. The icon is the Samaj logo (see public/sw.js).
            const d = n.data ?? {};
            const local = s.language !== 'en';
            const source = (local && d.title_local) || d.title || (local && d.group_local) || d.group || '';
            return {
                title: source || samajName(general, s.language) || t('app.name'),
                body: notificationText(n, t, s.language),
                link: n.link || '/notifications',
                tag: `${n.type}:${n.link ?? ''}`, // same thing twice replaces, not stacks
                ...icons,
            };
        });
    } catch (err) {
        console.error('push batch failed', err.message);
        return 0;
    }
}

/**
 * An admin's own message (Settings → Samaj → Push notification): the same title and text for everyone, push only —
 * no bell copy. Returns { people, devices, sent }.
 * @param {number[]} userIds
 * @param {{ title: string, body: string, link?: string|null }} m
 */
export async function pushMessage(userIds, { title, body, link = null }) {
    const ids = [...new Set(userIds.map(Number))].filter((n) => n > 0);
    if (!ids.length) return { people: 0, devices: 0, sent: 0 };
    const subs = await subscriptionsOf(ids);
    const people = new Set(subs.map((s) => s.user_id)).size;
    if (!ready()) return { people, devices: subs.length, sent: 0 };
    const tag = `custom:${Date.now()}`; // each message stays (never replaces the previous one)
    const icons = samajIcons(await getSettings('admin').catch(() => ({})));
    const payload = { title, body, link: link || '/', tag, ...icons };
    const sent = await deliver(subs, () => payload);
    return { people, devices: subs.length, sent };
}

/** A person's devices (tokens): when each was turned on and when a notification last reached it. */
export async function pushDevices(userId) {
    return query(`SELECT id, user_agent, created_at, last_used_at FROM users_push_subscriptions WHERE user_id = :userId ORDER BY created_at DESC`, { userId });
}
