import 'server-only';
import { getMeta, getMetaMany, inList, query, queryOne } from './db';
import { BLOOD_DONORS_FOR, BLOOD_GROUPS, ROLES } from './roles';
import { sp1 } from './url';

// `position` is the person's current post (Talati, ward member, trustee…) — free text,
// deliberately separate from the app role, which only decides permissions.
export const MEMBER_META_KEYS = ['position', 'address', 'occupation', 'education', 'email', 'alt_phone', 'bio'];
const STATUSES = ['active', 'inactive', 'deceased'];
const GENDERS = ['male', 'female', 'other'];

/**
 * Parse the directory's URL params once, so the page and the filter control cannot
 * disagree about what a param means. Unknown values fall back to the default (absence).
 */
export function resolveMemberFilters(sp = {}) {
    const pick = (v, allowed) => (allowed.includes(sp1(v)) ? sp1(v) : '');
    const posInt = (v) => (/^[1-9]d{0,9}$/.test(sp1(v)) ? Number(sp1(v)) : null);
    return {
        q: sp1(sp.q).trim().slice(0, 60),
        role: pick(sp.role, ROLES),
        blood: pick(sp.blood, BLOOD_GROUPS),
        compat: sp1(sp.compat) === '1',
        donor: sp1(sp.donor) === '1',
        village: sp1(sp.village).trim().slice(0, 100),
        city: sp1(sp.city).trim().slice(0, 100),
        gender: pick(sp.gender, GENDERS),
        caste: posInt(sp.caste),
        ...ageRange(sp1(sp.age_min), sp1(sp.age_max)),
        // A sub-caste only means something inside its caste.
        subcaste: posInt(sp.caste) ? posInt(sp.subcaste) : null,
        // Default view is active members; `status=all` shows everyone.
        status: sp1(sp.status) === 'all' ? 'all' : pick(sp.status, STATUSES) || 'active',
        // Default view is people who have signed in at least once; reg=unregistered / all to see the rest.
        reg: pick(sp.reg, ['unregistered', 'all']) || 'registered',
    };
}

/** Age bounds 0–120, clamped; reversed bounds are swapped rather than returning nothing. */
function ageRange(minRaw, maxRaw) {
    const parse = (v) => (/^\d{1,3}$/.test(v) ? Math.min(120, Number(v)) : null);
    let ageMin = parse(minRaw);
    let ageMax = parse(maxRaw);
    if (ageMin != null && ageMax != null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
    return { ageMin, ageMax };
}

export function activeFilterCount(f) {
    return [f.role, f.blood, f.donor, f.village, f.city, f.gender, f.caste, f.ageMin != null || f.ageMax != null, f.status !== 'active', f.reg !== 'registered']
        .filter(Boolean).length;
}

function whereFor(f) {
    const where = [];
    const params = {};
    if (f.status !== 'all') {
        where.push('u.status = :status');
        params.status = f.status;
    }
    // Registered = has signed in at least once; the others were invited or added from a family tree.
    if (f.reg === 'registered') where.push('u.last_login_at IS NOT NULL');
    else if (f.reg === 'unregistered') where.push('u.last_login_at IS NULL');
    if (f.q) {
        const digits = f.q.replace(/\D/g, '');
        params.like = `%${f.q}%`;
        const parts = ['u.full_name LIKE :like', 'u.full_name_local LIKE :like', 'u.village LIKE :like', 'u.city LIKE :like'];
        if (digits.length >= 3) {
            params.phone = `%${digits}%`;
            parts.push('u.phone LIKE :phone');
        }
        where.push(`(${parts.join(' OR ')})`);
    }
    if (f.role) {
        where.push('u.role = :role');
        params.role = f.role;
    }
    if (f.blood) {
        // "Compatible" widens the filter to every group that can GIVE to the chosen one.
        const groups = f.compat ? BLOOD_DONORS_FOR[f.blood] : [f.blood];
        const l = inList(groups, 'bg');
        where.push(`u.blood_group IN (${l.sql})`);
        Object.assign(params, l.params);
    }
    if (f.donor) where.push('u.is_blood_donor = 1');
    if (f.village) {
        where.push('u.village = :village');
        params.village = f.village;
    }
    if (f.city) {
        where.push('u.city = :city');
        params.city = f.city;
    }
    if (f.gender) {
        where.push('u.gender = :gender');
        params.gender = f.gender;
    }
    // Age as a dob range, so the comparison is on the column itself (indexable) rather than
    // on a computed age. Members with no dob drop out once an age filter is set.
    if (f.ageMin != null) {
        where.push('u.dob <= DATE_SUB(CURDATE(), INTERVAL :ageMin YEAR)');
        params.ageMin = f.ageMin;
    }
    if (f.ageMax != null) {
        where.push('u.dob > DATE_SUB(CURDATE(), INTERVAL :ageMaxNext YEAR)');
        params.ageMaxNext = f.ageMax + 1;
    }
    if (f.caste) {
        where.push('u.caste_id = :caste');
        params.caste = f.caste;
        if (f.subcaste) {
            where.push('u.subcaste_id = :subcaste');
            params.subcaste = f.subcaste;
        }
    }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/**
 * @param {ReturnType<typeof resolveMemberFilters>} f
 * @param {number} page    clamped by the caller (normalizePage)
 * @param {number} perPage clamped by the caller (normalizePerPage) — inlined as a literal
 */
export async function listMembers(f, page, perPage) {
    const w = whereFor(f);
    const offset = (page - 1) * perPage;
    const [countRow, rows] = await Promise.all([
        queryOne(`SELECT COUNT(*) AS n FROM users_list u ${w.sql}`, w.params),
        query(
            `SELECT u.id, u.full_name, u.full_name_local, u.phone, u.role, u.village, u.city, u.blood_group,
                    u.gender, u.dob, u.status, u.is_blood_donor, (u.password_hash IS NOT NULL) AS can_login, u.last_login_at, u.created_by,
                    c.name AS caste_name, c.name_local AS caste_name_local, sc.name AS subcaste_name, sc.name_local AS subcaste_name_local
               FROM users_list u
               LEFT JOIN admin_castes c ON c.id = u.caste_id
               LEFT JOIN admin_castes sc ON sc.id = u.subcaste_id
               ${w.sql}
              ORDER BY u.full_name, u.id
              LIMIT ${perPage} OFFSET ${offset}`,
            w.params,
        ),
    ]);
    // One meta read for the whole page — never a query per row.
    const meta = await getMetaMany('users_list', rows.map((r) => r.id), ['position', 'added_via']);
    return {
        total: countRow.n,
        rows: rows.map((r) => ({ ...r, position: meta[r.id]?.position ?? null, added_via: meta[r.id]?.added_via ?? null })),
    };
}

export async function listVillages() {
    const rows = await query(
        `SELECT village, COUNT(*) AS n FROM users_list WHERE village IS NOT NULL AND village <> ''
          GROUP BY village ORDER BY village`,
    );
    return rows.map((r) => ({ value: r.village, label: r.village, count: r.n }));
}

/** Current-residence cities with member counts, for the city filter and form suggestions. */
export async function listCities() {
    const rows = await query(
        `SELECT city, COUNT(*) AS n FROM users_list WHERE city IS NOT NULL AND city <> ''
          GROUP BY city ORDER BY city`,
    );
    return rows.map((r) => ({ value: r.city, label: r.city, count: r.n }));
}

export async function getMember(id) {
    const row = await queryOne(
        `SELECT u.id, u.phone, u.full_name, u.full_name_local, u.first_name, u.middle_name, u.surname,
                u.first_name_local, u.middle_name_local, u.surname_local, u.gender, u.dob, u.blood_group, u.village, u.city, u.role, u.language,
                u.is_blood_donor, u.status, u.marital_status, u.created_by, u.last_login_at, u.created_at, (u.password_hash IS NOT NULL) AS can_login,
                u.caste_id, u.subcaste_id, c.name AS caste_name, c.name_local AS caste_name_local,
                sc.name AS subcaste_name, sc.name_local AS subcaste_name_local
           FROM users_list u
           LEFT JOIN admin_castes c ON c.id = u.caste_id
           LEFT JOIN admin_castes sc ON sc.id = u.subcaste_id
          WHERE u.id = :id`,
        { id },
    );
    if (!row) return null;
    return { ...row, meta: await getMeta('users_list', id) };
}

export async function memberGroups(userId) {
    return query(
        `SELECT g.id, g.name, g.name_local, gm.member_role
           FROM admin_group_members gm JOIN admin_groups g ON g.id = gm.group_id
          WHERE gm.user_id = :userId AND g.status <> 'archived'
          ORDER BY gm.member_role = 'admin' DESC, g.name`,
        { userId },
    );
}

export async function listGroupsBrief() {
    return query(`SELECT id, name, name_local FROM admin_groups WHERE status = 'active' ORDER BY name`);
}

// ── family ─────────────────────────────────────────────────────────────────────



/**
 * What one member has given, per group and per fundraise. Anonymous gifts are hidden
 * from the public page, and here only counted when `includeAnonymous` (the member
 * themself, or someone who manages fundraises) — otherwise a profile would undo the
 * anonymity the donor asked for.
 */
export async function memberDonations(userId, includeAnonymous) {
    const rows = await query(
        `SELECT c.id AS campaign_id, c.title, c.title_local, c.status,
                g.id AS group_id, g.name AS group_name, g.name_local AS group_name_local,
                SUM(fc.amount) AS total, COUNT(*) AS gifts, MAX(fc.paid_on) AS last_paid
           FROM fundraise_contributions fc
           JOIN fundraise_campaigns c ON c.id = fc.campaign_id
           LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE fc.user_id = :userId AND fc.deleted_at IS NULL AND fc.mode <> 'unpaid' ${includeAnonymous ? '' : 'AND fc.is_anonymous = 0'}
          GROUP BY c.id, c.title, c.title_local, c.status, g.id, g.name, g.name_local
          ORDER BY last_paid DESC`,
        { userId },
    );
    const groups = new Map();
    for (const r of rows) {
        const key = r.group_id ?? 0;
        if (!groups.has(key)) groups.set(key, { id: r.group_id, name: r.group_name, name_local: r.group_name_local, total: 0, campaigns: [] });
        const g = groups.get(key);
        g.total += Number(r.total);
        g.campaigns.push(r);
    }
    const list = [...groups.values()].sort((a, b) => b.total - a.total);
    return { total: list.reduce((s, g) => s + g.total, 0), gifts: rows.reduce((s, r) => s + Number(r.gifts), 0), groups: list };
}
