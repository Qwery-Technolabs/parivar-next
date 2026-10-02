import 'server-only';

// Read-mostly lists (castes for pickers, active groups, villages / cities / place suggestions …) are
// read on many pages and change rarely: keep them in memory per server instance for MEMO_TTL, so most
// requests skip those queries. Writers call forget('<area>') right after a successful change, so this
// instance shows it at once; other instances catch up within MEMO_TTL. The promise is cached, so
// requests arriving together share one query. A failed load is not cached. Each caller gets its own copy
// (structuredClone — the lists are small), so a page that pushes into its list never changes the cache.

export const MEMO_TTL = 60 * 1000;
const store = (globalThis.__parivarMemo ??= new Map()); // key → { at, value: Promise }

/**
 * @template T
 * @param {string} key   '<area>:<variant>' — forget() clears by area prefix
 * @param {() => Promise<T>} load
 * @param {number} [ttl]
 * @returns {Promise<T>}
 */
export async function memo(key, load, ttl = MEMO_TTL) {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttl) return structuredClone(await hit.value);
    const value = load();
    store.set(key, { at: Date.now(), value });
    try {
        return structuredClone(await value);
    } catch (err) {
        if (store.get(key)?.value === value) store.delete(key);
        throw err;
    }
}

/** Drop cached entries of these areas ('castes', 'groups', 'places' …) — call after a write. */
export function forget(...areas) {
    for (const key of store.keys()) if (areas.some((a) => key === a || key.startsWith(`${a}:`))) store.delete(key);
}
