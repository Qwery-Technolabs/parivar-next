import 'server-only';
import { queryOne } from './db';
import { age } from './format';
import { atLeast } from './roles';
import { getSettings } from './settings';

// Contact numbers: women see everyone's, men see every man's. The ONE restriction is a man seeing a woman's number —
// Settings → Permissions → "Women's contact numbers" (admin settings):
//   female_phone_viewers  WHO may see a woman's number (any of):
//     same_surname · close (≤ CLOSE family steps) · married · over35 · same_village · same_city · everyone
//   female_phone_shown    WHOSE numbers may be shown (any of):
//     over30 · married · daughter / sister / aunt (in the viewer's close family, ≤ CLOSE steps) · everyone
// A number shows when the viewer passes the first AND the woman the second. Always: women viewers, app admins
// (sub-admin and up), an admin woman's number, and everyone's own. It applies on the member PROFILE only; in lists
// (Members, group Members, Blood donors, search) a woman's number is shown to women and admins only (hideWomenPhones).
// Where someone was added from (a family tree or not) no longer hides contact details.

export const CLOSE = 5;
export const FEMALE_VIEWER_OPTIONS = ['same_surname', 'close', 'married', 'over35', 'same_village', 'same_city', 'everyone'];
export const FEMALE_SHOWN_OPTIONS = ['over30', 'married', 'daughter', 'sister', 'aunt', 'everyone'];

const MARRIED = ['married', 'widowed', 'divorced'];
const isAdmin = (role) => atLeast(role, 'sub_admin');
/** Sees every number without the settings: women, admins (sub-admin and up). */
export const seesAllNumbers = (viewer) => Boolean(viewer) && (viewer.gender === 'female' || isAdmin(viewer.role));

/** Her place in the viewer's family from the viewer → her steps: daughter / sister / aunt (father's or mother's sister, or a parent's brother's wife). */
function kinOf(steps) {
    if (!steps?.length || steps.length > CLOSE) return null;
    const last = steps.at(-1);
    const prev = steps.at(-2);
    if (last === 'daughter') return 'daughter';
    if (last === 'sister' && (prev === 'father' || prev === 'mother')) return 'aunt';
    if (last === 'wife' && prev === 'brother' && ['father', 'mother'].includes(steps.at(-3))) return 'aunt';
    if (last === 'sister') return 'sister';
    return null;
}

/**
 * May `viewer` see `woman`'s phone numbers on her profile?
 * @param {{ id: number, role: string }} viewer  getCurrentUser()
 * @param {{ id: number, role: string, gender: string, surname?: string, maiden_surname?: string, marital_status?: string, dob?: string, village?: string, city?: string }} person
 * @param {{ steps: string[] } | null} relation  relationPath(viewer → person), already loaded by the profile page
 */
export async function canSeeContact(viewer, person, relation = null) {
    if (!viewer || !person) return false;
    if (person.gender !== 'female' || viewer.id === person.id || seesAllNumbers(viewer) || isAdmin(person.role)) return true;
    const s = await getSettings('admin');
    const who = new Set(s.female_phone_viewers);
    const whose = new Set(s.female_phone_shown);
    const steps = relation?.steps ?? null;

    const kin = kinOf(steps);
    const herAge = person.dob ? age(person.dob) : null;
    const herOk =
        whose.has('everyone') ||
        (whose.has('over30') && herAge != null && herAge > 30) ||
        (whose.has('married') && MARRIED.includes(person.marital_status)) ||
        (kin != null && whose.has(kin));
    if (!herOk) return false;
    if (who.has('everyone')) return true;
    if (who.has('close') && steps && steps.length <= CLOSE) return true;

    // The rest compare the viewer's own details: one small read, only when it can matter.
    const me = await queryOne('SELECT gender, surname, marital_status, dob, village, city FROM users_list WHERE id = :id', { id: viewer.id });
    if (!me) return false;
    const same = (a, b) => Boolean(a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase());
    const myAge = me.dob ? age(me.dob) : null;
    return (
        (who.has('same_surname') && (same(me.surname, person.surname) || same(me.surname, person.maiden_surname))) ||
        (who.has('married') && MARRIED.includes(me.marital_status)) ||
        (who.has('over35') && myAge != null && myAge > 35) ||
        (who.has('same_village') && same(me.village, person.village)) ||
        (who.has('same_city') && same(me.city, person.city))
    );
}

/** In lists: a woman's number only for women, admins (and herself) — men open her profile, where canSeeContact decides. */
export function hideWomenPhones(rows, viewer) {
    if (seesAllNumbers(viewer)) return rows;
    return rows.map((r) => (r.gender === 'female' && r.id !== viewer?.id ? { ...r, phone: null } : r));
}
