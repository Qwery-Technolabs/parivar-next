import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { query, queryOne } from './db';
import { atLeast } from './roles';

export const SESSION_COOKIE = 'pv_session';
const SESSION_DAYS = 30;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function hashPassword(plain) {
    return bcrypt.hash(plain, 10);
}

// Compared against when the phone is unknown or has no password, so the response time
// does not reveal which phone numbers are registered.
const DUMMY_HASH = bcrypt.hashSync('parivar-timing-pad', 10);

export async function verifyPassword(plain, hash) {
    const ok = await bcrypt.compare(String(plain ?? ''), hash || DUMMY_HASH);
    return Boolean(hash) && ok;
}

/** Passwords: 6–72 chars (bcrypt ignores bytes past 72, so a longer one would be a lie). */
export function passwordProblem(plain) {
    if (typeof plain !== 'string' || plain.length < 6) return 'auth.errors.passwordShort';
    if (Buffer.byteLength(plain) > 72) return 'auth.errors.passwordLong';
    return null;
}

export async function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const ua = (await headers()).get('user-agent')?.slice(0, 255) ?? null;
    await query(
        `INSERT INTO users_sessions (token_hash, user_id, expires_at, user_agent)
         VALUES (:h, :uid, DATE_ADD(NOW(), INTERVAL ${SESSION_DAYS} DAY), :ua)`,
        { h: sha256(token), uid: userId, ua },
    );
    await query('UPDATE users_list SET last_login_at = NOW() WHERE id = :uid', { uid: userId });
    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
}

export async function destroySession() {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) await query('DELETE FROM users_sessions WHERE token_hash = :h', { h: sha256(token) });
    jar.delete(SESSION_COOKIE);
}

/** Revoke every session of a user except, optionally, the current one. */
export async function revokeUserSessions(userId, keepCurrent = false) {
    const token = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : null;
    await query(
        `DELETE FROM users_sessions WHERE user_id = :uid ${token ? 'AND token_hash <> :h' : ''}`,
        token ? { uid: userId, h: sha256(token) } : { uid: userId },
    );
}

/**
 * The signed-in user, read fresh from users_list so a role change applies on the next request.
 * Cached per request.
 * @returns {Promise<null | { id: number, phone: string, full_name: string, full_name_gu: string|null, role: string, language: string }>}
 */
export const getCurrentUser = cache(async () => {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return queryOne(
        `SELECT u.id, u.phone, u.full_name, u.full_name_gu, u.role, u.language
           FROM users_sessions s JOIN users_list u ON u.id = s.user_id
          WHERE s.token_hash = :h AND s.expires_at > NOW() AND u.status = 'active'`,
        { h: sha256(token) },
    );
});

export async function requireUser() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    return user;
}

/** For pages: redirect away when under-privileged. */
export async function requireRole(min) {
    const user = await requireUser();
    if (!atLeast(user.role, min)) redirect('/');
    return user;
}
