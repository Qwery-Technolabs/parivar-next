// Pure module — client and server. A member's name in parts: first name, father's name
// (middle) and surname. full_name stays the join of the parts, so search, lists and the
// family tree keep reading one field.

const tidy = (s) =>
    String(s ?? '')
        .trim()
        .replace(/\s+/g, ' ');

/**
 * A typed English name in Name Case: each word's first letter capital, the rest small — "manthan",
 * "MANTHAN" → "Manthan"; after a hyphen or apostrophe too ("patel-shah" → "Patel-Shah"). Spaces tidied.
 * Scripts without capitals (Gujarati, Hindi) are left exactly as typed. Empty stays empty.
 */
export function nameCase(s) {
    return tidy(s)
        .toLowerCase()
        .replace(/(^|[\s\-'’.])(\p{Ll})/gu, (_, before, ch) => before + ch.toUpperCase());
}

/** "First Father Surname" from the parts (blank parts skipped). */
export function composeName({ first = '', middle = '', surname = '' } = {}) {
    return [first, middle, surname].map(tidy).filter(Boolean).join(' ');
}

/**
 * Split a whole name the way old records were split: 1 word → first; 2 words → first +
 * surname; 3+ words → first, the middle word(s) as father's name, last word as surname.
 * A digits-only "name" (an invite standing in the phone number) gives no parts.
 * @returns {{ first: string, middle: string, surname: string }}
 */
export function splitName(full) {
    const s = tidy(full);
    if (!s || /^\d+$/.test(s)) return { first: '', middle: '', surname: '' };
    const w = s.split(' ');
    if (w.length === 1) return { first: w[0], middle: '', surname: '' };
    if (w.length === 2) return { first: w[0], middle: '', surname: w[1] };
    return { first: w[0], middle: w.slice(1, -1).join(' '), surname: w.at(-1) };
}

/** Marital states in which a woman carries her husband's name (and keeps a maiden name). */
export const MARRIED_LIKE = ['married', 'widowed', 'divorced'];

/** A married (or widowed / divorced) woman: main name = first + husband's name + in-laws' surname. */
export function isMarriedWoman(p) {
    return p?.gender === 'female' && MARRIED_LIKE.includes(p?.marital_status);
}

/**
 * Her name as her birth family knows it — first + father's name + father's surname (maiden) —
 * or null when no maiden name is stored. `local` = the local-script spelling.
 */
export function birthName(p, local = false) {
    if (!p) return null;
    const middle = local ? p.maiden_middle_name_local : p.maiden_middle_name;
    const surname = local ? p.maiden_surname_local : p.maiden_surname;
    if (!middle && !surname) return null;
    return composeName({ first: local ? p.first_name_local || p.first_name : p.first_name, middle, surname }) || null;
}
