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
    const raw = key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
    if (typeof raw !== 'string') return key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name) => (vars[name] ?? m));
}

/** Pick the Gujarati field when the UI is Gujarati and it is filled, else the base field. */
export function localized(row, field, locale) {
    if (!row) return '';
    return (locale === 'gu' && row[`${field}_gu`]) || row[field] || '';
}
