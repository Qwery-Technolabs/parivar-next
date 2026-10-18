// Pure module — client and server. Nearby Homes filters ↔ the page's URL (lib/homes.js resolveHomeFilters reads it).

/** The filters as the page's URL (empty ones left out). */
export function homeFiltersHref(f) {
    const p = new URLSearchParams();
    if (f.family) p.set('family', '1');
    for (const [k, v] of [
        ['city', f.city],
        ['village', f.village],
        ['surname', f.surname],
        ['age_min', f.ageMin],
        ['age_max', f.ageMax],
    ]) {
        if (v != null && String(v).trim() !== '') p.set(k, String(v).trim());
    }
    const qs = p.toString();
    return qs ? `/nearby?${qs}` : '/nearby';
}

export const NO_HOME_FILTERS = { family: false, city: '', village: '', surname: '', ageMin: null, ageMax: null };
