import 'server-only';
import { getMetaMany, inList, query, queryOne } from './db';
import { BLOOD_DONORS_FOR, BLOOD_GROUPS } from './roles';

export const REQUEST_STATUSES = ['open', 'fulfilled', 'cancelled'];

/** Parse /blood search params once, so the page and its controls agree. Clamp, never trust. */
export function resolveBloodFilters(sp = {}) {
    const one = (v) => (Array.isArray(v) ? v[0] : v) ?? '';
    const tab = one(sp.tab) === 'donors' ? 'donors' : 'requests';
    const rawStatus = one(sp.status);
    const status = rawStatus === 'all' || REQUEST_STATUSES.includes(rawStatus) ? rawStatus : 'open';
    const group = BLOOD_GROUPS.includes(one(sp.group)) ? one(sp.group) : '';
    const compatible = one(sp.compatible) === '1';
    const village = String(one(sp.village)).trim().slice(0, 100);
    return { tab, status, group, compatible, village };
}

export async function listRequests({ status, page, perPage }) {
    const where = status === 'all' ? '1=1' : 'r.status = :status';
    const params = { status };
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM blood_requests r WHERE ${where}`, params);
    const offset = (page - 1) * perPage;
    // perPage/offset are server-clamped integers — inlined deliberately (DESIGN.md §9).
    const rows = await query(
        `SELECT r.id, r.blood_group, r.units, r.patient_name, r.hospital, r.city, r.contact_phone,
                r.needed_by, r.status, r.created_by, r.created_at, u.full_name AS creator_name, u.full_name_gu AS creator_name_gu
           FROM blood_requests r LEFT JOIN users_list u ON u.id = r.created_by
          WHERE ${where}
          ORDER BY (r.status = 'open') DESC, r.needed_by IS NULL, r.needed_by, r.id DESC
          LIMIT ${perPage} OFFSET ${offset}`,
        params,
    );
    const meta = await getMetaMany('blood_requests', rows.map((r) => r.id), ['notes']);
    return { total, rows: rows.map((r) => ({ ...r, notes: meta[r.id]?.notes ?? '' })) };
}

export async function getRequest(id) {
    return queryOne('SELECT id, status, created_by FROM blood_requests WHERE id = :id', { id });
}

/** Active donors who can give to `group` (or exactly `group` when compatible is off). */
export async function listDonors({ group, compatible, village }) {
    if (!group) return [];
    const groups = compatible ? BLOOD_DONORS_FOR[group] : [group];
    const list = inList(groups, 'bg');
    const params = { ...list.params };
    let where = `status = 'active' AND is_blood_donor = 1 AND blood_group IN (${list.sql})`;
    if (village) {
        where += ' AND village LIKE :village';
        params.village = `%${village}%`;
    }
    return query(
        `SELECT id, full_name, full_name_gu, phone, village, blood_group
           FROM users_list WHERE ${where}
          ORDER BY blood_group = :exact DESC, full_name LIMIT 200`,
        { ...params, exact: group },
    );
}
