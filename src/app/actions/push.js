'use server';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { inList, query, queryOne } from '@/lib/db';
import { str } from '@/lib/forms';
import { pushDevices, pushMessage } from '@/lib/push';
import { canManageMemberPush, canManageSettings } from '@/lib/roles';

const FORBIDDEN = { error: 'common.forbidden' };
const PUSH_TARGETS = ['all', 'groups', 'members'];
const ids = (fd, name) => [...new Set(fd.getAll(name).map(Number))].filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);

/**
 * Settings → Samaj → Push notification: an admin's own message to people's devices — push only, no bell copy.
 * Fields: title, body, target (all | groups | members), group_ids[], member_ids[]; for ONE member also devices
 * (all | selected) + device_ids[].
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
    // One member's chosen devices (profile ⋮ → Notification devices → Send): devices = 'selected' + device_ids[].
    const someDevices = target === 'members' && memberIds.length === 1 && fd.get('devices') === 'selected';
    const deviceIds = someDevices ? ids(fd, 'device_ids') : null;
    if (someDevices && !deviceIds.length) fieldErrors.devices = 'push.devices.pickDevices';
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
    const r = await pushMessage(people, { title, body, deviceIds });
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
