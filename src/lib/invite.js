import 'server-only';
import { audit } from './audit';
import { hashPassword } from './auth';
import { query, queryOne, setMeta } from './db';

/**
 * Find or create the member behind a mobile number, for invites (Members page, group Add).
 *   registered            → returned as is
 *   listed, no password   → may now log in with the number as password
 *   unknown number        → a member account (sabhyo) is created with this name
 * In the last two cases the first password is the phone number itself and
 * users_listmeta.must_change_password makes them choose their own on first sign-in, then
 * fill in their details.
 * @param {{ id: number }} actor
 * @param {string} phone normalized digits
 * @param {string} fullName required only when the number is new
 * @param {string|null} fullNameLocal
 * @returns {Promise<{ id: number, status: 'created'|'enabled'|'existing' } | { error: string }>}
 */
export async function ensureInvitedUser(actor, phone, fullName, fullNameLocal = null) {
    const user = await queryOne('SELECT id, password_hash, status FROM users_list WHERE phone = :phone', { phone });
    if (user?.status === 'deceased') return { error: 'groups.invite.unavailable' };
    if (user?.password_hash) return { id: user.id, status: 'existing' };
    const hash = await hashPassword(phone);
    if (user) {
        await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash, id: user.id });
        await setMeta('users_list', user.id, { must_change_password: '1', invited_by: String(actor.id) });
        return { id: user.id, status: 'enabled' };
    }
    if (!fullName) return { error: 'common.required' };
    const r = await query(
        `INSERT INTO users_list (phone, password_hash, full_name, full_name_local, role, status, created_by)
         VALUES (:phone, :hash, :fullName, :fullNameLocal, 'sabhyo', 'active', :by)`,
        { phone, hash, fullName, fullNameLocal: fullNameLocal || null, by: actor.id },
    );
    await setMeta('users_list', r.insertId, { must_change_password: '1', invited_by: String(actor.id) });
    await audit(actor.id, 'user.create', 'user', r.insertId, { via: 'invite' });
    return { id: r.insertId, status: 'created' };
}
