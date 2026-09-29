'use server';
import { refresh, revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser, hashPassword, passwordProblem, revokeUserSessions, verifyPassword } from '@/lib/auth';
import { query, queryOne, setMeta } from '@/lib/db';
import { normalizeLocalLanguage } from '@/lib/local-language';
import { normalizePhone } from '@/lib/phone';

async function currentWithHash() {
    const user = await getCurrentUser();
    if (!user) return null;
    const row = await queryOne('SELECT password_hash FROM users_list WHERE id = :id', { id: user.id });
    return { ...user, password_hash: row?.password_hash ?? null };
}

/** Change own login phone. Requires the current password — the phone IS the login id. */
export async function changePhone(prev, fd) {
    const user = await currentWithHash();
    if (!user) return { error: 'common.forbidden' };

    const phone = normalizePhone(fd.get('phone'));
    if (!phone) return { fieldErrors: { phone: 'auth.errors.phoneInvalid' } };
    if (!(await verifyPassword(String(fd.get('current_password') ?? ''), user.password_hash)))
        return { fieldErrors: { current_password: 'auth.errors.currentWrong' } };
    if (phone === user.phone) return { ok: true, message: 'profile.phoneChanged' };

    const taken = await queryOne('SELECT id FROM users_list WHERE phone = :phone AND id <> :id', { phone, id: user.id });
    if (taken) return { fieldErrors: { phone: 'auth.errors.phoneTaken' } };

    try {
        await query('UPDATE users_list SET phone = :phone WHERE id = :id', { phone, id: user.id });
    } catch (err) {
        // Lost a race with another registration of the same number (unique key).
        if (err.code === 'ER_DUP_ENTRY') return { fieldErrors: { phone: 'auth.errors.phoneTaken' } };
        throw err;
    }
    await audit(user.id, 'user.phone', 'user', user.id, { from: user.phone, to: phone });
    refresh();
    return { ok: true, message: 'profile.phoneChanged' };
}

export async function changePassword(prev, fd) {
    const user = await currentWithHash();
    if (!user) return { error: 'common.forbidden' };

    const current = String(fd.get('current_password') ?? '');
    const next = String(fd.get('new_password') ?? '');
    const confirm = String(fd.get('confirm_password') ?? '');

    if (!(await verifyPassword(current, user.password_hash))) return { fieldErrors: { current_password: 'auth.errors.currentWrong' } };
    const problem = passwordProblem(next);
    if (problem) return { fieldErrors: { new_password: problem } };
    if (next !== confirm) return { fieldErrors: { confirm_password: 'auth.errors.passwordMismatch' } };

    await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash: await hashPassword(next), id: user.id });
    // Keep this device signed in; every other device must log in with the new password.
    await revokeUserSessions(user.id, true);
    await audit(user.id, 'user.password', 'user', user.id);
    return { ok: true, message: 'profile.passwordChanged' };
}

/** The script this person writes names in (Gujarati / Hindi / Marathi). Stored as meta: never filtered on. */
export async function setLocalLanguage(formData) {
    const user = await getCurrentUser();
    if (!user) return;
    // A forged call without form data is ignored, not a 500.
    const lang = normalizeLocalLanguage(String(formData?.get?.('local_language') ?? ''));
    if (!lang) return;
    await setMeta('users_list', user.id, { local_language: lang });
    revalidatePath('/', 'layout'); // forms everywhere pick the new script up
}
