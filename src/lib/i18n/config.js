// Pure module — client and server.

export const LOCALES = ['gu', 'en'];
export const DEFAULT_LOCALE = 'gu';
export const LANG_COOKIE = 'lang';
export const LANG_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeLocale(value) {
    return LOCALES.includes(value) ? value : null;
}

/**
 * Look up a dotted key, interpolating {name} placeholders. A missing key returns the
 * key itself, so a gap shows up on screen instead of rendering as nothing.
 */
export function translate(dict, key, vars) {
    let raw = key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
    // Plural entries are { one, other }: "1 member" / "3 members", picked by vars.count.
    if (raw && typeof raw === 'object' && typeof raw.other === 'string') raw = Number(vars?.count) === 1 ? (raw.one ?? raw.other) : raw.other;
    if (typeof raw !== 'string') return key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name) => (vars[name] ?? m));
}

/** The local-language spelling (`<field>_local`) when the UI is not English and it is filled, else the base field. */
export function localized(row, field, locale) {
    if (!row) return '';
    return (locale === 'gu' && row[`${field}_local`]) || row[field] || '';
}
