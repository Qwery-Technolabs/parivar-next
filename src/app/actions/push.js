'use server';
import { headers } from 'next/headers';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { inList, query, queryOne } from '@/lib/db';
import { str } from '@/lib/forms';
import { pushDevices, pushMessage } from '@/lib/push';
import { canManageMemberPush, canManageSettings } from '@/lib/roles';

const FORBIDDEN = { error: 'common.forbidden' };
const PUSH_TARGETS = ['all', 'groups', 'members'];
/**
 * The optional "Open page" of a message: a page of THIS app — "/fundraise/12", or the full address copied from the
 * browser (its path is kept). Empty → null (the home page). Another site → false (refused).
 */
async function appLink(raw) {
    const v = String(raw ?? '')
        .trim()
        .slice(0, 500);
    if (!v) return null;
    const host = (await headers()).get('host') ?? 'localhost';
    try {
        const u = new URL(v.startsWith('/') && !v.startsWith('//') ? v : /^https?:\/\//i.test(v) ? v : `/${v}`, `https://${host}`);
        if (u.host !== host) return false;
        return (u.pathname + u.search + u.hash).slice(0, 300);
    } catch {
        return false;
    }
}

const ids = (fd, name) => [...new Set(fd.getAll(name).map(Number))].filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);

/**
 * Settings → Samaj → Push notification: an admin's own message to people's devices — push only, no bell copy.
 * Fields: title, body, link (optional page to open), target (all | groups | members), group_ids[], member_ids[]; for ONE member also
 * device_ids[] ('all' or the chosen device ids).
 * Only active members with notifications turned on are reached; the result says how many.
 */
export async function sendPushMessage(prev, fd) {
    const actor = await getCurrentUser();
    const title = str(fd, 'title', 80);
    const body = str(fd, 'body', 300);
    const target = PUSH_TARGETS.includes(String(fd.get('target'))) ? String(fd.get('target')) : 'all';
    // Everyone / groups: administrators (Settings). Chosen members (e.g. one member's profile): sub-admins too.
    if (!actor || !(canManageSettings(actor.role) || (target === 'members' && canManageMemberPush(actor.role)))) return FORBIDDEN;
    const groupIds = ids(fd, 'group_ids');
    const memberIds = ids(fd, 'member_ids');
    const fieldErrors = {};
    if (!title) fieldErrors.title = 'common.required';
    if (!body) fieldErrors.body = 'common.required';
    if (target === 'groups' && !groupIds.length) fieldErrors.target = 'push.admin.pickGroups';
    if (target === 'members' && !memberIds.length) fieldErrors.target = 'push.admin.pickMembers';
    // One member's chosen devices (profile ⋮ → Notification devices → Send): device_ids[] = 'all' or device ids.
    const rawDevices = fd.has('device_ids') ? fd.getAll('device_ids').map(String).filter(Boolean) : null;
    const someDevices = target === 'members' && memberIds.length === 1 && rawDevices !== null && !rawDevices.includes('all');
    const deviceIds = someDevices ? ids(fd, 'device_ids') : null;
    if (someDevices && !deviceIds.length) fieldErrors.devices = 'push.devices.pickDevices';
    const link = await appLink(fd.get('link'));
    if (link === false) fieldErrors.link = 'push.admin.linkInvalid';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    // Only people who have a device turned on (and are active) — everyone else could not receive it anyway.
    let sql = `SELECT DISTINCT s.user_id FROM users_push_subscriptions s JOIN users_list u ON u.id = s.user_id WHERE u.status = 'active'`;
    let params = {};
    if (target === 'groups') {
        const l = inList(groupIds, 'g');
        sql += ` AND s.user_id IN (SELECT user_id FROM admin_group_members WHERE group_id IN (${l.sql}))`;
        params = l.params;
    } else if (target === 'members') {
        const l = inList(memberIds, 'm');
        sql += ` AND s.user_id IN (${l.sql})`;
        params = l.params;
    }
    const people = (await query(sql, params)).map((r) => r.user_id);
    if (!people.length) return { error: 'push.admin.nobody' };
    const r = await pushMessage(people, { title, body, deviceIds, link });
    await audit(actor.id, 'push.send', 'settings', null, { title, target, groups: groupIds.length || undefined, people: r.people, sent: r.sent });
    return { ok: true, message: 'push.admin.sent', vars: { sent: r.sent, devices: r.devices, people: r.people } };
}

/** May this viewer see / remove a member's notification devices? Sub-admins and up only. */
const canSeeDevices = (actor) => Boolean(actor) && canManageMemberPush(actor.role);

/** A member's devices for the profile's ⋮ → Notification devices pop-up (loaded when it opens). */
export async function loadPushDevices(userId) {
    const actor = await getCurrentUser();
    const uid = Number(userId);
    if (!canSeeDevices(actor, uid)) return FORBIDDEN;
    return { devices: await pushDevices(uid) };
}

/** Remove one device (token): that browser gets nothing more until it is turned on again there. */
export async function deletePushDevice(deviceId) {
    const actor = await getCurrentUser();
    const row = await queryOne('SELECT id, user_id FROM users_push_subscriptions WHERE id = :id', { id: Number(deviceId) || 0 });
    if (!row) return { ok: true };
    if (!canSeeDevices(actor, row.user_id)) return FORBIDDEN;
    await query('DELETE FROM users_push_subscriptions WHERE id = :id', { id: row.id });
    await audit(actor.id, 'push.device.remove', 'user', row.user_id, { device: row.id });
    return { ok: true, message: 'push.devices.removed' };
}

/**
 * Members list → the red slashed bell (no device turned on): remind this member — the next time they open the app,
 * the "Turn on notifications?" pop-up shows again, even inside its 7 days. Sub-admins and up.
 * Stored as users_listmeta push_remind (when it was asked); cleared once shown.
 */
export async function remindPush(userId) {
    const actor = await getCurrentUser();
    const uid = Number(userId);
    if (!actor || !canManageMemberPush(actor.role) || !Number.isInteger(uid) || uid <= 0) return FORBIDDEN;
    const person = await queryOne("SELECT id FROM users_list WHERE id = :uid AND status = 'active'", { uid });
    if (!person) return { error: 'common.error' };
    await query(
        `INSERT INTO users_listmeta (user_id, meta_key, meta_value) VALUES (:uid, 'push_remind', :at)
         ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
        { uid, at: String(Date.now()) },
    );
    await audit(actor.id, 'push.remind', 'user', uid, {});
    return { ok: true, message: 'push.remind.sent' };
}

/** The app just opened without notifications: was this person reminded? Then true once (the reminder is used up). */
export async function takePushReminder() {
    const user = await getCurrentUser();
    if (!user) return false;
    const r = await query("DELETE FROM users_listmeta WHERE user_id = :uid AND meta_key = 'push_remind'", { uid: user.id });
    return r.affectedRows > 0;
}
