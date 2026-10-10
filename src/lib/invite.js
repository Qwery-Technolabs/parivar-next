import 'server-only';
import { audit } from './audit';
import { hashPassword } from './auth';
import { query, queryOne, setMeta } from './db';
import { splitName, nameCase } from './names';
import { applySurnameCastes } from './surnames';

const nullParts = (p) => ({ first: p.first || null, middle: p.middle || null, surname: p.surname || null });

/**
 * Find or create the member behind a mobile number, for invites (Members page, group Add).
 *   registered            → returned as is
 *   listed, no password   → may now log in with the number as password
 *   unknown number        → a member account (sabhyo) is created (name optional)
 * In the last two cases the first password is the phone number itself and
 * users_listmeta.must_change_password makes them choose their own on first sign-in, then
 * fill in their details.
 * @param {{ id: number }} actor
 * @param {string} phone normalized digits
 * @param {string} [fullName] optional — without one the phone number stands in as the name until
 *   they fill in their details after first sign-in
 * @param {string|null} [fullNameLocal]
 * @returns {Promise<{ id: number, status: 'created'|'enabled'|'existing' } | { error: string }>}
 */
export async function ensureInvitedUser(actor, phone, rawFullName = '', fullNameLocal = null) {
    // A typed English name in Name Case ("manthan kanani" → "Manthan Kanani").
    const fullName = nameCase(rawFullName);
    const user = await queryOne('SELECT id, password_hash, status FROM users_list WHERE phone = :phone', { phone });
    if (user?.status === 'deceased') return { error: 'groups.invite.unavailable' };
    if (user?.password_hash) return { id: user.id, status: 'existing' };
    const hash = await hashPassword(phone);
    if (user) {
        await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash, id: user.id });
        await setMeta('users_list', user.id, { must_change_password: '1', invited_by: String(actor.id) });
        return { id: user.id, status: 'enabled' };
    }
    const r = await query(
        `INSERT INTO users_list (phone, password_hash, full_name, full_name_local, first_name, middle_name, surname, role, status, created_by)
         VALUES (:phone, :hash, :fullName, :fullNameLocal, :first, :middle, :surname, 'sabhyo', 'active', :by)`,
        // Parts from the typed name, if any; the person completes them after first sign-in.
        { phone, hash, fullName: fullName || phone, fullNameLocal: fullNameLocal || null, ...nullParts(splitName(fullName)), by: actor.id },
    );
    await setMeta('users_list', r.insertId, { must_change_password: '1', invited_by: String(actor.id) });
    await applySurnameCastes([r.insertId]); // the surname's caste (Members ⋮ → Surnames)
    await audit(actor.id, 'user.create', 'user', r.insertId, { via: 'invite' });
    return { id: r.insertId, status: 'created' };
}
