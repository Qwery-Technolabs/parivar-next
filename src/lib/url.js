// Pure module — client and server.

/**
 * Rebuild an href from the FULL current param set with overrides applied, so a
 * pagination or sort link never drops the filter the page was rendered under.
 * A null/'' override removes the param (the default is absence).
 * @param {string} pathname
 * @param {Record<string, string|string[]|undefined>} current
 * @param {Record<string, string|number|null|undefined>} overrides
 */
export function buildHref(pathname, current, overrides = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(current ?? {})) {
        if (v == null || v === '') continue;
        if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
        else params.set(k, v);
    }
    for (const [k, v] of Object.entries(overrides)) {
        if (v == null || v === '') params.delete(k);
        else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}

/** Only same-origin relative paths — `?next=//evil.com` must not become an open redirect. */
export function safeNext(value, fallback = '/') {
    const s = typeof value === 'string' ? value : '';
    return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : fallback;
}

/** First value of a search param (Next gives string | string[] | undefined). */
export function sp1(value) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
