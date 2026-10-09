// Pure module — the public Mandal page's / PDF's filter from the URL.
//   ?schedule=<id>      one schedule
//   ?schedule=all       every schedule (optionally &from=YYYY-MM-DD&to=… — a date range)
//   (no schedule)       the LATEST schedule held (the default: a short page, a light PDF)
//   ?show=all|absent    whom to list (default: those who came)
// An older link with only from/to still means "all, in that range". Anything malformed is ignored.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MANDAL_SHOWS = ['present', 'all', 'absent'];
export const DEFAULT_SHOW = 'present';

export function mandalFilters(sp = {}) {
    const one = (v) => String(Array.isArray(v) ? v[0] : (v ?? '')).trim();
    const raw = sp.schedule === undefined ? null : one(sp.schedule);
    const day = (v) => (DAY.test(one(v)) ? one(v) : '');
    const rangeOnly = raw === null && Boolean(day(sp.from) || day(sp.to));
    const all = raw === '' || raw === 'all' || rangeOnly;
    const schedule = all ? null : Number(raw) || null;
    const show = MANDAL_SHOWS.includes(one(sp.show)) ? one(sp.show) : DEFAULT_SHOW;
    return {
        all,
        schedule,
        // Nothing (valid) asked for: the latest schedule — lib/mandal mandalLedger resolves which.
        latest: !all && !schedule,
        from: all ? day(sp.from) : '',
        to: all ? day(sp.to) : '',
        show,
    };
}

/** The URL query for a filter (links: PDF, Back, chips); `over` changes some of it. Defaults are left out. */
export function mandalQuery(f, over = {}) {
    const x = { ...f, ...over };
    const q = new URLSearchParams();
    if (x.all) {
        q.set('schedule', 'all');
        if (x.from) q.set('from', x.from);
        if (x.to) q.set('to', x.to);
    } else if (x.schedule) q.set('schedule', String(x.schedule));
    if (x.show && x.show !== DEFAULT_SHOW) q.set('show', x.show);
    return q.toString();
}

/** The latest schedule held by `today` (else the soonest coming one) from a newest-first list. */
export function latestSchedule(schedules, today) {
    return schedules.find((s) => String(s.start_date).slice(0, 10) <= today) ?? schedules.at(-1) ?? null;
}
