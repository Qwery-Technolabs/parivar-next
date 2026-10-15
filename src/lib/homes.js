import { query, queryOne } from '@/lib/db';
import { localized } from '@/lib/i18n/config';
import { formatPhone } from '@/lib/phone';

// Nearby Homes: home pins (users_listmeta home_lat / home_lng) of active MEN only — a woman's pin is saved but never
// shown. The map loads only the homes of the area on screen (homesInArea), never the whole list at once.

/** At most this many homes per area; a fuller area loads afresh when zoomed in. */
export const AREA_LIMIT = 300;

const LAT = 'CAST(la.meta_value AS DECIMAL(10,6))';
const LNG = 'CAST(ln.meta_value AS DECIMAL(10,6))';
const FROM = `FROM users_list u
               JOIN users_listmeta la ON la.user_id = u.id AND la.meta_key = 'home_lat' AND la.meta_value <> ''
               JOIN users_listmeta ln ON ln.user_id = u.id AND ln.meta_key = 'home_lng' AND ln.meta_value <> ''
              WHERE u.gender = 'male' AND u.status = 'active'`;
const COLS = `u.id, u.full_name, u.full_name_local, u.village, u.city, u.phone, la.meta_value AS lat, ln.meta_value AS lng,
              (SELECT meta_value FROM users_listmeta WHERE user_id = u.id AND meta_key = 'address') AS address,
              (SELECT meta_value FROM users_listmeta WHERE user_id = u.id AND meta_key = 'added_via') AS added_via`;

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
        // A relative added from a family tree keeps the phone for the family (as on the profile): not on the map.
        phone: r.added_via === 'family' || !r.phone ? null : { tel: r.phone, text: formatPhone(r.phone) },
        lat,
        lng,
    };
}

/** How many homes are pinned, and the box around them all (where the map opens when nothing else is asked). */
export async function homesSummary() {
    const r = await queryOne(`SELECT COUNT(*) AS n, MIN(${LAT}) AS s, MAX(${LAT}) AS n2, MIN(${LNG}) AS w, MAX(${LNG}) AS e ${FROM}`);
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
export async function homeOf(userId, locale) {
    if (!userId) return null;
    const r = await queryOne(`SELECT ${COLS} ${FROM} AND u.id = :userId`, { userId });
    return r ? toHome(r, locale) : null;
}

/** The homes inside a box { s, w, n, e } (at most AREA_LIMIT). */
export async function homesInArea(box, locale) {
    const rows = await query(
        `SELECT ${COLS} ${FROM}
            AND ${LAT} BETWEEN :s AND :n AND ${LNG} BETWEEN :w AND :e
          LIMIT ${AREA_LIMIT}`,
        box,
    );
    return rows.map((r) => toHome(r, locale)).filter(Boolean);
}
