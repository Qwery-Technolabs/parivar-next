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
    // Donors are found where they live now (current city), not by native village.
    const city = String(one(sp.city)).trim().slice(0, 100);
    const q = String(one(sp.q)).trim().slice(0, 100);
    return { tab, status, group, compatible, city, q };
}

export async function listRequests({ status, q = '', page, perPage }) {
    const conds = status === 'all' ? [] : ['r.status = :status'];
    const params = { status };
    if (q) {
        conds.push('(r.patient_name LIKE :q OR r.hospital LIKE :q OR r.city LIKE :q OR r.contact_phone LIKE :q)');
        params.q = `%${q}%`;
    }
    const where = conds.length ? conds.join(' AND ') : '1=1';
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM blood_requests r WHERE ${where}`, params);
    const offset = (page - 1) * perPage;
    // perPage/offset are server-clamped integers — inlined deliberately (design-system.md §9).
    const rows = await query(
        `SELECT r.id, r.blood_group, r.units, r.patient_name, r.hospital, r.city, r.contact_phone,
                r.needed_by, r.status, r.created_by, r.created_at, u.full_name AS creator_name, u.full_name_local AS creator_name_local
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

/**
 * Active donors. With `group`: those who can give to it (or exactly it when compatible is
 * off); without: every donor. `q` matches name, local name, village, city or phone.
 */
export async function listDonors({ group, compatible, city, q = '' }) {
    const params = {};
    let where = `status = 'active' AND is_blood_donor = 1`;
    if (group) {
        const list = inList(compatible ? BLOOD_DONORS_FOR[group] : [group], 'bg');
        where += ` AND blood_group IN (${list.sql})`;
        Object.assign(params, list.params);
    }
    if (q) {
        where += ' AND (full_name LIKE :q OR full_name_local LIKE :q OR village LIKE :q OR city LIKE :q OR phone LIKE :q)';
        params.q = `%${q}%`;
    }
    if (city) {
        where += ' AND city LIKE :city';
        params.city = `%${city}%`;
    }
    return query(
        `SELECT id, full_name, full_name_local, phone, city, blood_group
           FROM users_list WHERE ${where}
          ORDER BY blood_group = :exact DESC, full_name LIMIT 200`,
        { ...params, exact: group || '' },
    );
}
