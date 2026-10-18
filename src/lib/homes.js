import { inList, query, queryOne } from '@/lib/db';
import { familyIds } from '@/lib/family';
import { localized } from '@/lib/i18n/config';
import { formatPhone } from '@/lib/phone';

// Nearby Homes: home pins (users_listmeta home_lat / home_lng) of active MEN only — a woman's pin is saved but never
// shown. The map loads only the homes of the area on screen (homesInArea), never the whole list at once.

/**
 * Which homes to show (Nearby ⋮ → Filters, in the URL): family = only my family tree (everyone connected to me),
 * city (current city), village (native village), surname, ageMin / ageMax (years). Empty = everyone.
 * Read from the page's searchParams or from the object the map sends with each area request — same rules.
 */
export function resolveHomeFilters(src = {}) {
    const one = (v) => (Array.isArray(v) ? v[0] : v);
    const text = (v, max) =>
        String(one(v) ?? '')
            .trim()
            .slice(0, max);
    const age = (v) => (/^\d{1,3}$/.test(String(one(v) ?? '')) ? Math.min(120, Number(one(v))) : null);
    let ageMin = age(src.age_min ?? src.ageMin);
    let ageMax = age(src.age_max ?? src.ageMax);
    if (ageMin != null && ageMax != null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
    return {
        family: ['1', 'true', true].includes(one(src.family)),
        city: text(src.city, 100),
        village: text(src.village, 100),
        surname: text(src.surname, 60),
        ageMin,
        ageMax,
    };
}

/** How many filters are set (for "Filters (2)"). */
export const homeFilterCount = (f) => [f.family, f.city, f.village, f.surname, f.ageMin != null || f.ageMax != null].filter(Boolean).length;

/** The filters as extra SQL over `u` (" AND …") — values bound, never pasted. */
async function filterSql(f, viewerId) {
    const where = [];
    const params = {};
    if (!f) return { sql: '', params };
    if (f.city) {
        where.push('u.city = :fCity');
        params.fCity = f.city;
    }
    if (f.village) {
        where.push('u.village = :fVillage');
        params.fVillage = f.village;
    }
    if (f.surname) {
        where.push('(u.surname = :fSurname OR u.surname_local = :fSurname)');
        params.fSurname = f.surname;
    }
    // Age from the birth date (people without one are left out once an age is asked).
    if (f.ageMin != null) {
        where.push('u.dob IS NOT NULL AND u.dob <= DATE_SUB(CURDATE(), INTERVAL :fAgeMin YEAR)');
        params.fAgeMin = f.ageMin;
    }
    if (f.ageMax != null) {
        where.push('u.dob IS NOT NULL AND u.dob > DATE_SUB(CURDATE(), INTERVAL :fAgeMax1 YEAR)');
        params.fAgeMax1 = f.ageMax + 1;
    }
    if (f.family && viewerId) {
        const l = inList([...(await familyIds(viewerId))], 'fFam');
        where.push(`u.id IN (${l.sql})`);
        Object.assign(params, l.params);
    }
    return { sql: where.length ? ` AND ${where.join(' AND ')}` : '', params };
}

/** At most this many homes per area; a fuller area loads afresh when zoomed in. */
export const AREA_LIMIT = 300;

const LAT = 'CAST(la.meta_value AS DECIMAL(10,6))';
const LNG = 'CAST(ln.meta_value AS DECIMAL(10,6))';
const FROM = `FROM users_list u
               JOIN users_listmeta la ON la.user_id = u.id AND la.meta_key = 'home_lat' AND la.meta_value <> ''
               JOIN users_listmeta ln ON ln.user_id = u.id AND ln.meta_key = 'home_lng' AND ln.meta_value <> ''
              WHERE u.gender = 'male' AND u.status = 'active'`;
const COLS = `u.id, u.full_name, u.full_name_local, u.village, u.city, u.phone, la.meta_value AS lat, ln.meta_value AS lng,
              (SELECT meta_value FROM users_listmeta WHERE user_id = u.id AND meta_key = 'address') AS address`;

function toHome(r, locale) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
        id: r.id,
        name: localized(r, 'full_name', locale),
        village: r.village,
        city: r.city,
        address: r.address || '',
        // Homes are men's profiles, and a man's number is for every member (lib/contact-privacy — the same rule as the
        // profile and Members). Should women's homes ever show, their numbers must go through hideWomenPhones.
        phone: r.phone ? { tel: r.phone, text: formatPhone(r.phone) } : null,
        lat,
        lng,
    };
}

/** How many homes are pinned, and the box around them all (where the map opens when nothing else is asked). */
export async function homesSummary(f = null, viewerId = null) {
    const w = await filterSql(f, viewerId);
    const r = await queryOne(`SELECT COUNT(*) AS n, MIN(${LAT}) AS s, MAX(${LAT}) AS n2, MIN(${LNG}) AS w, MAX(${LNG}) AS e ${FROM}${w.sql}`, w.params);
    const n = Number(r?.n) || 0;
    return {
        count: n,
        bounds: n
            ? [
                  [Number(r.s), Number(r.w)],
                  [Number(r.n2), Number(r.e)],
              ]
            : null,
    };
}

/** One home (the ?focus one, or the viewer's own), or null when that person has none on the map. */
export async function homeOf(userId, locale, f = null, viewerId = null) {
    if (!userId) return null;
    const w = await filterSql(f, viewerId);
    const r = await queryOne(`SELECT ${COLS} ${FROM} AND u.id = :userId${w.sql}`, { userId, ...w.params });
    return r ? toHome(r, locale) : null;
}

/** The homes inside a box { s, w, n, e } (at most AREA_LIMIT), narrowed by the filters. */
export async function homesInArea(box, locale, f = null, viewerId = null) {
    const w = await filterSql(f, viewerId);
    const rows = await query(
        `SELECT ${COLS} ${FROM}
            AND ${LAT} BETWEEN :s AND :n AND ${LNG} BETWEEN :w AND :e${w.sql}
          LIMIT ${AREA_LIMIT}`,
        { ...box, ...w.params },
    );
    return rows.map((r) => toHome(r, locale)).filter(Boolean);
}
