'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, destroySession, getCurrentUser, hashPassword, passwordProblem, verifyPassword } from '@/lib/auth';
import { query, queryOne, setMeta } from '@/lib/db';
import { str, strOrNull } from '@/lib/forms';
import { notifyMany } from '@/lib/notifications';
import { atLeast } from '@/lib/roles';
import { getSettings } from '@/lib/settings';
import { LANG_COOKIE, LANG_MAX_AGE, normalizeLocale } from '@/lib/i18n/config';
import { normalizePhone } from '@/lib/phone';
import { safeNext } from '@/lib/url';

/** Set the UI language: cookie always, and the profile when signed in. */
export async function setLanguage(formData) {
    const locale = normalizeLocale(formData?.get?.('locale'));
    if (!locale) return;
    (await cookies()).set(LANG_COOKIE, locale, { path: '/', maxAge: LANG_MAX_AGE, sameSite: 'lax' });
    const user = await getCurrentUser();
    if (user) await query('UPDATE users_list SET language = :locale WHERE id = :id', { locale, id: user.id });
    const next = formData?.get?.('next');
    if (next) redirect(safeNext(next));
}

// A throttle per phone, in memory: enough to stop a script guessing passwords from one
// process. Behind several instances this needs a shared store.
const attempts = globalThis.__pvLoginAttempts ?? new Map();
globalThis.__pvLoginAttempts = attempts;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export async function login(prev, formData) {
    const phone = normalizePhone(formData.get('phone'));
    const password = String(formData.get('password') ?? '');
    const values = { phone: String(formData.get('phone') ?? '') };
    if (!phone) return { error: 'auth.errors.phoneInvalid', values };

    const now = Date.now();
    const rec = attempts.get(phone);
    if (rec && now - rec.first < WINDOW_MS && rec.count >= MAX_ATTEMPTS) return { error: 'auth.errors.invalid', values };

    const user = await queryOne(
        `SELECT u.id, u.password_hash, u.language,
                (SELECT m.meta_value FROM users_listmeta m WHERE m.user_id = u.id AND m.meta_key = 'must_change_password') AS must_change
           FROM users_list u WHERE u.phone = :phone AND u.status = 'active'`,
        { phone },
    );
    const ok = await verifyPassword(password, user?.password_hash);
    if (!user || !ok) {
        attempts.set(phone, rec && now - rec.first < WINDOW_MS ? { ...rec, count: rec.count + 1 } : { first: now, count: 1 });
        return { error: 'auth.errors.invalid', values };
    }
    attempts.delete(phone);

    await createSession(user.id);
    // The profile's language wins over the device's on login — the person chose it once.
    (await cookies()).set(LANG_COOKIE, user.language, { path: '/', maxAge: LANG_MAX_AGE, sameSite: 'lax' });
    // Still on the temporary password (their phone number): choose a real one before anything else.
    if (user.must_change) redirect('/set-password');
    redirect(safeNext(formData.get('next')));
}

/**
 * First sign-in of someone added by phone number: replace the temporary password (the
 * number itself) with one of their own. It may not be the phone number again.
 */
export async function setInitialPassword(prev, formData) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    const password = String(formData.get('password') ?? '');
    const pwErr = passwordProblem(password);
    if (pwErr) return { fieldErrors: { password: pwErr } };
    if (password === user.phone) return { fieldErrors: { password: 'auth.setPassword.notPhone' } };
    if (password !== String(formData.get('confirm') ?? '')) return { fieldErrors: { confirm: 'auth.errors.passwordMismatch' } };
    await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash: await hashPassword(password), id: user.id });
    await setMeta('users_list', user.id, { must_change_password: '' });
    // Next: fill in their own details (they were added with just a name and number).
    redirect(`/members/${user.id}/edit?welcome=1`);
}

/**
 * Self sign-up from the login page — only while an admin has it switched on
 * (admin_settings.allow_registration). New people are plain members (sabhyo). With
 * registration_approval on they wait inactive (cannot log in) and admins are notified;
 * otherwise they are signed straight in.
 */
export async function register(prev, formData) {
    const settings = await getSettings('admin');
    if (!settings.allow_registration) return { error: 'auth.register.closed' };
    const values = {
        full_name: str(formData, 'full_name', 150),
        full_name_local: str(formData, 'full_name_local', 150),
        phone: str(formData, 'phone', 30),
        village: str(formData, 'village', 100),
        city: str(formData, 'city', 100),
    };
    const phone = normalizePhone(formData.get('phone'));
    const password = String(formData.get('password') ?? '');
    const fieldErrors = {};
    if (!values.full_name) fieldErrors.full_name = 'common.required';
    if (!phone) fieldErrors.phone = 'auth.errors.phoneInvalid';
    const pwErr = passwordProblem(password);
    if (pwErr) fieldErrors.password = pwErr;
    else if (password !== String(formData.get('confirm') ?? '')) fieldErrors.confirm = 'auth.errors.passwordMismatch';
    if (Object.keys(fieldErrors).length) return { fieldErrors, values };

    // Same throttle as login, keyed apart: stops a script from mass-creating accounts.
    const key = `reg:${phone}`;
    const now = Date.now();
    const rec = attempts.get(key);
    if (rec && now - rec.first < WINDOW_MS && rec.count >= MAX_ATTEMPTS) return { error: 'auth.register.tooMany', values };
    attempts.set(key, rec && now - rec.first < WINDOW_MS ? { ...rec, count: rec.count + 1 } : { first: now, count: 1 });

    if (await queryOne('SELECT id FROM users_list WHERE phone = :phone', { phone })) {
        return { fieldErrors: { phone: 'auth.errors.phoneTaken' }, values };
    }
    const pending = settings.registration_approval;
    const language = normalizeLocale((await cookies()).get(LANG_COOKIE)?.value) || settings.default_language;
    const r = await query(
        `INSERT INTO users_list (phone, password_hash, full_name, full_name_local, village, city, role, status, language)
         VALUES (:phone, :hash, :full_name, :full_name_local, :village, :city, 'sabhyo', :status, :language)`,
        {
            phone,
            hash: await hashPassword(password),
            full_name: values.full_name,
            full_name_local: strOrNull(formData, 'full_name_local', 150),
            village: strOrNull(formData, 'village', 100),
            city: strOrNull(formData, 'city', 100),
            status: pending ? 'inactive' : 'active',
            language,
        },
    );
    const newId = r.insertId;
    // Everyone who can approve (sub-admin and up) hears about it.
    const approvers = (await query("SELECT id, role FROM users_list WHERE status = 'active' AND role IN ('super_admin', 'administrator', 'sub_admin')"))
        .filter((a) => atLeast(a.role, 'sub_admin'))
        .map((a) => a.id);
    await notifyMany(approvers, {
        type: pending ? 'member.pending' : 'member.joined',
        data: { name: values.full_name },
        link: `/members/${newId}/edit?tab=access`,
    });
    if (pending) return { ok: true, pending: true };
    await createSession(newId);
    redirect('/');
}

export async function logout() {
    await destroySession();
    redirect('/login');
}
