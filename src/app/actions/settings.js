'use server';
import { revalidatePath } from 'next/cache';
import { writeAppIcons } from '@/lib/app-icons';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { setMeta, withTransaction } from '@/lib/db';
import { NOTIFY_CATEGORIES } from '@/lib/notification-prefs';
import { sanitizeAvatar } from '@/lib/group-avatar';
import { canManageSettings } from '@/lib/roles';
import { coerceSetting, saveSettings, SETTINGS } from '@/lib/settings';

/** Save one module's settings. Fields are `<key>`; unknown keys are ignored by coerceSetting. */
export async function saveModuleSettings(prev, fd) {
    const user = await getCurrentUser();
    if (!user || !canManageSettings(user.role)) return { error: 'common.forbidden' };
    const mod = String(fd.get('module') ?? '');
    const spec = SETTINGS[mod];
    if (!spec) return { error: 'common.error' };

    const values = {};
    for (const key of Object.keys(spec.keys)) {
        // A switch always posts its hidden input; a field that is absent means "leave as is".
        if (!fd.has(key)) continue;
        values[key] = coerceSetting(mod, key, fd.get(key));
    }
    // General carries the Samaj logo picker (same values and checks as a group picture).
    if (mod === 'admin' && fd.has('avatar_kind')) {
        const a = sanitizeAvatar(String(fd.get('avatar_kind') ?? ''), String(fd.get('avatar_value') ?? ''), String(fd.get('avatar_color') ?? ''));
        Object.assign(values, { logo_kind: a.avatar_kind, logo_value: a.avatar_value, logo_color: a.avatar_color });
        // The same logo, drawn in the browser, as favicon / app icon (stored in the DB — lib/app-icons.js).
        if (fd.has('logo_png_512') && (await writeAppIcons({ 512: fd.get('logo_png_512'), 192: fd.get('logo_png_192'), 32: fd.get('logo_png_32') }))) {
            values.logo_version = String(Date.now());
        }
    }
    await withTransaction((q) => saveSettings(mod, values, q));
    await audit(user.id, 'settings.update', 'settings', null, { module: mod, keys: Object.keys(values) });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'common.saved' };
}


/** Settings → Notifications: the categories this person wants (the rest are stored as off). */
export async function saveNotificationPrefs(prev, fd) {
    const user = await getCurrentUser();
    if (!user) return { error: 'common.forbidden' };
    const on = new Set(fd.getAll('on').map(String));
    const off = NOTIFY_CATEGORIES.filter((c) => !on.has(c));
    await setMeta('users_list', user.id, { notify_off: off.join(',') });
    return { ok: true, message: 'common.saved' };
}

/** Settings → Notifications (administrators): app-wide sending switches. */
export async function saveAdminNotify(prev, fd) {
    const user = await getCurrentUser();
    if (!user || !canManageSettings(user.role)) return { error: 'common.forbidden' };
    const donors = coerceSetting('blood', 'notify_donors', fd.get('notify_donors'));
    const events = coerceSetting('events', 'notify_new_event', fd.get('notify_new_event'));
    await withTransaction(async (q) => {
        await saveSettings('blood', { notify_donors: donors }, q);
        await saveSettings('events', { notify_new_event: events }, q);
    });
    await audit(user.id, 'settings.update', 'settings', null, { module: 'notifications', keys: ['notify_donors', 'notify_new_event'] });
    revalidatePath('/settings');
    return { ok: true, message: 'common.saved' };
}
