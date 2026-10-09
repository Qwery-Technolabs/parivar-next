// Pure module — a Mandal's ledger / printout filter from the URL.
//   ?schedule=4,7       those schedules (one or several)
//   ?schedule=all       every schedule (optionally &from=YYYY-MM-DD&to=… — a date range)
//   (no schedule)       public link: the LATEST schedule held (a light default) · app print: all
//   ?show=…             whom to list on the schedule sheets: present | all | absent
//   ?view=…             the printout: contributors (default) | schedules | expenses
// An older link with only from/to still means "all, in that range". Anything malformed is ignored.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MANDAL_SHOWS = ['present', 'all', 'absent'];
export const MANDAL_VIEWS = ['contributors', 'schedules', 'expenses'];
export const DEFAULT_SHOW = 'present';
// Defaults per place: the public link opens light (latest schedule, those who came); the app's print opens on everything.
export const MANDAL_MODES = {
    public: { show: 'present', none: 'latest', allToken: 'all' },
    app: { show: 'all', none: 'all', allToken: null },
};

export function mandalFilters(sp = {}, mode = 'public') {
    const m = MANDAL_MODES[mode] ?? MANDAL_MODES.public;
    const one = (v) => String(Array.isArray(v) ? v[0] : (v ?? '')).trim();
    const raw = sp.schedule === undefined ? null : one(sp.schedule);
    const day = (v) => (DAY.test(one(v)) ? one(v) : '');
    const ids =
        raw && raw !== 'all'
            ? [
                  ...new Set(
                      raw
                          .split(',')
                          .map(Number)
                          .filter((n) => Number.isInteger(n) && n > 0),
                  ),
              ]
            : [];
    const rangeOnly = raw === null && Boolean(day(sp.from) || day(sp.to));
    const all = !ids.length && (raw === '' || raw === 'all' || rangeOnly || (raw === null && m.none === 'all'));
    return {
        mode,
        all,
        ids,
        // One schedule chosen (pages with a single-schedule picker).
        schedule: ids.length === 1 ? ids[0] : null,
        // Nothing (valid) asked for on the public link: the latest schedule — lib/mandal mandalLedger resolves which.
        latest: !all && !ids.length,
        from: all ? day(sp.from) : '',
        to: all ? day(sp.to) : '',
        show: MANDAL_SHOWS.includes(one(sp.show)) ? one(sp.show) : m.show,
        view: MANDAL_VIEWS.includes(one(sp.view)) ? one(sp.view) : MANDAL_VIEWS[0],
    };
}

/**
 * The URL query for a filter (links: PDF, Back, chips); `over` changes some of it (`ids`, or `all: true`;
 * neither = the mode's default). Defaults of the filter's mode are left out.
 */
export function mandalQuery(f, over = {}) {
    const x = { ...f, ...over };
    if (over.schedule !== undefined) x.ids = over.schedule ? [over.schedule] : [];
    const m = MANDAL_MODES[x.mode] ?? MANDAL_MODES.public;
    const q = new URLSearchParams();
    if (x.view && x.view !== MANDAL_VIEWS[0]) q.set('view', x.view);
    if (x.ids?.length) q.set('schedule', x.ids.join(','));
    else if (x.all) {
        if (m.allToken) q.set('schedule', m.allToken);
        if (x.from) q.set('from', x.from);
        if (x.to) q.set('to', x.to);
    }
    if (x.show && x.show !== m.show) q.set('show', x.show);
    return q.toString();
}

/** The latest schedule held by `today` (else the soonest coming one) from a newest-first list. */
export function latestSchedule(schedules, today) {
    return schedules.find((s) => String(s.start_date).slice(0, 10) <= today) ?? schedules.at(-1) ?? null;
}
