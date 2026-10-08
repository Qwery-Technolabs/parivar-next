// Pure module — the public Mandal ledger's filter from the URL (?schedule=<id> | ?from=YYYY-MM-DD&to=…).
// A schedule wins over a range; anything malformed is ignored. `query` rebuilds the same filter for
// links (the PDF, Back).
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function mandalFilters(sp = {}) {
    const one = (v) => String(Array.isArray(v) ? v[0] : (v ?? '')).trim();
    const schedule = Number(one(sp.schedule)) || null;
    const from = schedule || !DAY.test(one(sp.from)) ? '' : one(sp.from);
    const to = schedule || !DAY.test(one(sp.to)) ? '' : one(sp.to);
    const query = new URLSearchParams(Object.entries({ schedule: schedule ?? '', from, to }).filter(([, v]) => v)).toString();
    return { schedule, from, to, query };
}
