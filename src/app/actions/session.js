'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, destroySession, getCurrentUser, verifyPassword } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
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
        `SELECT id, password_hash, language FROM users_list WHERE phone = :phone AND status = 'active'`,
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
    redirect(safeNext(formData.get('next')));
}

export async function logout() {
    await destroySession();
    redirect('/login');
}
