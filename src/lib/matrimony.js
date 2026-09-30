import 'server-only';
import { familyIds } from './family';
import { getMetaMany, inList, query, queryOne } from './db';
import { canManageMembers } from './roles';

// Matrimony: opt-in listings (matrimony_profiles) of unmarried members aged 18+. The person's
// own record supplies name, age, gender, place and caste; education / occupation are their
// users_listmeta keys. A listing drops off by itself once they marry or are marked late.

export const INCOME_RANGES = ['lt3', '3to6', '6to10', '10to20', 'gt20'];
export const MIN_AGE = 18;

/** Listed people must be alive, unmarried (or not set) and 18+ by birth date. */
const ELIGIBLE = `u.status = 'active' AND (u.marital_status IS NULL OR u.marital_status = 'unmarried')
    AND u.dob IS NOT NULL AND u.dob <= DATE_SUB(CURDATE(), INTERVAL ${MIN_AGE} YEAR)`;

/**
 * WHO MAY BROWSE the matrimony list and open profiles. Kept strict until the Samaj decides:
 * member managers, and families that have a listed profile themselves (the candidate or anyone
 * connected to them in the family tree). Change it here only — every page and action asks this.
 */
export async function canBrowseMatrimony(user) {
    if (!user) return false;
    if (canManageMembers(user.role)) return true;
    const ids = [...(await familyIds(user.id))];
    const l = inList(ids, 'b');
    const row = await queryOne(`SELECT 1 AS ok FROM matrimony_profiles WHERE is_active = 1 AND user_id IN (${l.sql}) LIMIT 1`, l.params);
    return Boolean(row);
}

/**
 * May `actor` list / edit / remove this person's profile?
 *   - the person themselves, and member managers;
 *   - their father or mother;
 *   - when their father has passed away (marked late): anyone in their family tree (a guardian —
 *     elder brother, uncle, grandparent …).
 * No father recorded counts as "father alive" (strict): only the person, their mother, managers.
 */
export async function canListFor(actor, personId) {
    if (!actor) return false;
    if (actor.id === personId || canManageMembers(actor.role)) return true;
    const parents = await query(
        `SELECT r.relation, u.id, u.status FROM users_relations r JOIN users_list u ON u.id = r.relative_id
          WHERE r.user_id = :personId AND r.relation IN ('father', 'mother')`,
        { personId },
    );
    if (parents.some((p) => p.id === actor.id)) return true;
    const father = parents.find((p) => p.relation === 'father');
    return Boolean(father && father.status === 'deceased') && (await familyIds(actor.id)).has(personId);
}

/** Is this person eligible to be listed (alive, unmarried, 18+ with a birth date)? */
export async function isEligible(personId) {
    return Boolean(await queryOne(`SELECT 1 AS ok FROM users_list u WHERE u.id = :personId AND ${ELIGIBLE}`, { personId }));
}

/** People in the actor's family (themselves included) whom the actor may list, with whether they are listed. */
export async function listableInFamily(actor) {
    const ids = [...(await familyIds(actor.id))];
    const l = inList(ids, 'e');
    const rows = await query(
        `SELECT u.id, u.full_name, u.full_name_local, u.gender, u.dob, (mp.is_active = 1) AS listed
           FROM users_list u LEFT JOIN matrimony_profiles mp ON mp.user_id = u.id
          WHERE u.id IN (${l.sql}) AND ${ELIGIBLE}
          ORDER BY u.full_name`,
        l.params,
    );
    const allowed = await Promise.all(rows.map((r) => canListFor(actor, r.id)));
    return rows.filter((_, i) => allowed[i]);
}

const LIST_COLS = `u.id, u.full_name, u.full_name_local, u.gender, u.dob, u.village, u.city,
    c.name AS caste_name, c.name_local AS caste_name_local, sc.name AS subcaste_name, sc.name_local AS subcaste_name_local,
    mp.height_cm, mp.income_range`;

/**
 * Active, still-eligible listings, filtered: gender, age range, caste, place (village or city).
 * @param {{ gender?: string, ageMin?: number, ageMax?: number, casteId?: number, place?: string }} f
 */
export async function listProfiles(f = {}) {
    const where = ['mp.is_active = 1', ELIGIBLE];
    const params = {};
    if (f.gender) {
        where.push('u.gender = :gender');
        params.gender = f.gender;
    }
    if (f.ageMin) {
        where.push('u.dob <= DATE_SUB(CURDATE(), INTERVAL :ageMin YEAR)');
        params.ageMin = f.ageMin;
    }
    if (f.ageMax) {
        where.push('u.dob > DATE_SUB(CURDATE(), INTERVAL :ageMaxPlus YEAR)');
        params.ageMaxPlus = f.ageMax + 1;
    }
    if (f.casteId) {
        where.push('u.caste_id = :casteId');
        params.casteId = f.casteId;
    }
    if (f.place) {
        where.push('(u.village LIKE :place OR u.city LIKE :place)');
        params.place = `%${f.place}%`;
    }
    const rows = await query(
        `SELECT ${LIST_COLS}
           FROM matrimony_profiles mp JOIN users_list u ON u.id = mp.user_id
           LEFT JOIN admin_castes c ON c.id = u.caste_id
           LEFT JOIN admin_castes sc ON sc.id = u.subcaste_id
          WHERE ${where.join(' AND ')}
          ORDER BY mp.updated_at DESC
          LIMIT 200`,
        params,
    );
    const meta = await getMetaMany('users_list', rows.map((r) => r.id), ['education', 'occupation']);
    return rows.map((r) => ({ ...r, education: meta[r.id]?.education ?? null, occupation: meta[r.id]?.occupation ?? null }));
}

/** One person's matrimony profile (listed or not) with their member details; null if no such person. */
export async function getProfile(personId) {
    const row = await queryOne(
        `SELECT ${LIST_COLS}, u.first_name, u.middle_name, u.surname, u.status, u.marital_status, u.caste_id,
                mp.user_id AS has_profile, mp.is_active, mp.contact_name, mp.contact_phone, mp.pref_age_min, mp.pref_age_max,
                mp.pref_caste_id, mp.pref_city, mp.pref_education, mp.about, mp.listed_by,
                pc.name AS pref_caste_name, pc.name_local AS pref_caste_name_local
           FROM users_list u
           LEFT JOIN matrimony_profiles mp ON mp.user_id = u.id
           LEFT JOIN admin_castes c ON c.id = u.caste_id
           LEFT JOIN admin_castes sc ON sc.id = u.subcaste_id
           LEFT JOIN admin_castes pc ON pc.id = mp.pref_caste_id
          WHERE u.id = :personId`,
        { personId },
    );
    if (!row) return null;
    const meta = await getMetaMany('users_list', [row.id], ['education', 'occupation']);
    return { ...row, education: meta[row.id]?.education ?? null, occupation: meta[row.id]?.occupation ?? null };
}
