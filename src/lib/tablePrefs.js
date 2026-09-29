// Pure module — client and server. DESIGN.md §6: page NUMBER in the URL, page SIZE in a cookie.

export const PER_PAGE_COOKIE = 'table_per_page';
export const PER_PAGE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PER_PAGE = 20;
export const PER_PAGE_MAX_AGE = 60 * 60 * 24 * 365;

/** Clamp to an allowed option. The cookie is user-writable and goes straight into LIMIT. */
export function normalizePerPage(value) {
    const n = Number(value);
    return PER_PAGE_OPTIONS.includes(n) ? n : DEFAULT_PER_PAGE;
}

export function normalizePage(value) {
    const n = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(n) && n > 0 && n < 100000 ? n : 1;
}
