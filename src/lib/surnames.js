import 'server-only';
import { query } from './db';

// Surnames → caste / sub-caste (admin_surnames). The list a manager sees is every surname a
// member already uses (from anywhere: added, invited, registered, family tree) plus the ones
// saved here; each can be given a caste and sub-caste. Members WITHOUT a caste get the one
// their surname maps to — when they are created, invited, register, are added from a family
// tree, change their surname, or when the mapping is saved. A caste someone set is never changed.

/**
 * Every surname in use or saved, with its caste mapping and how many members carry it.
 * @returns {Promise<Array<{ id: number|null, name: string, name_local: string|null, caste_id: number|null, subcaste_id: number|null, members: number }>>}
 */
export async function listSurnames() {
    const [saved, used] = await Promise.all([
        query('SELECT id, name, name_local, caste_id, subcaste_id FROM admin_surnames ORDER BY name'),
        query(
            `SELECT surname AS name, MAX(surname_local) AS name_local, COUNT(*) AS members
               FROM users_list WHERE surname IS NOT NULL AND surname <> '' GROUP BY surname`,
        ),
    ]);
    const key = (s) => String(s ?? '').trim().toLowerCase();
    const byName = new Map(saved.map((s) => [key(s.name), { ...s, members: 0 }]));
    for (const u of used) {
        const row = byName.get(key(u.name));
        if (row) {
            row.members = Number(u.members);
            row.name_local ??= u.name_local;
        } else byName.set(key(u.name), { id: null, name: u.name, name_local: u.name_local, caste_id: null, subcaste_id: null, members: Number(u.members) });
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Give members without a caste the caste of their surname (English or local spelling).
 * `userIds` = only those people; omitted = everyone. Returns how many were filled.
 * @param {number[]|null} [userIds]
 * @param {Function} [q] a transaction's query
 */
export async function applySurnameCastes(userIds = null, q = query) {
    const ids = (userIds ?? []).map(Number).filter(Boolean);
    if (userIds && !ids.length) return 0;
    const only = ids.length ? `AND u.id IN (${ids.map((_, i) => `:u${i}`).join(',')})` : '';
    const params = Object.fromEntries(ids.map((v, i) => [`u${i}`, v]));
    const r = await q(
        `UPDATE users_list u
           JOIN admin_surnames s ON (s.name = u.surname OR (s.name_local IS NOT NULL AND s.name_local = u.surname_local))
            SET u.caste_id = s.caste_id, u.subcaste_id = s.subcaste_id
          WHERE u.caste_id IS NULL AND s.caste_id IS NOT NULL ${only}`,
        params,
    );
    return r?.affectedRows ?? 0;
}
