'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
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
    await withTransaction((q) => saveSettings(mod, values, q));
    await audit(user.id, 'settings.update', 'settings', null, { module: mod, keys: Object.keys(values) });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'common.saved' };
}
