// Pure module — client and server. A member's name in parts: first name, father's name
// (middle) and surname. full_name stays the join of the parts, so search, lists and the
// family tree keep reading one field.

const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

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
