import 'server-only';
import { audit } from './audit';
import { hashPassword } from './auth';
import { query, queryOne, setMeta } from './db';
import { splitName } from './names';
import { applySurnameCastes } from './surnames';
import { canInviteMembers } from './roles';

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
export async function ensureInvitedUser(actor, phone, fullName = '', fullNameLocal = null) {
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

/**
 * Delete an invited account that was never used — only when ALL hold: never signed in, came
 * from an invite, in no group any more, no contribution recorded under them, and the actor
 * invited them or may invite members (sub-admin and up). Anything else keeps the account.
 * @returns {Promise<boolean>} whether it was deleted
 */
export async function deleteUnusedInvitee(actor, userId) {
    const u = await queryOne(
        `SELECT u.id, u.last_login_at,
                (SELECT meta_value FROM users_listmeta WHERE user_id = u.id AND meta_key = 'invited_by') AS invited_by,
                (SELECT COUNT(*) FROM admin_group_members WHERE user_id = u.id) AS group_count,
                (SELECT COUNT(*) FROM fundraise_contributions WHERE user_id = u.id) AS contribution_count
           FROM users_list u WHERE u.id = :userId`,
        { userId },
    );
    if (!u || u.last_login_at || !u.invited_by || u.group_count > 0 || u.contribution_count > 0) return false;
    if (Number(u.invited_by) !== actor.id && !canInviteMembers(actor.role)) return false;
    await query('DELETE FROM users_list WHERE id = :userId', { userId });
    await audit(actor.id, 'user.delete', 'user', userId, { reason: 'unused_invite' });
    return true;
}
