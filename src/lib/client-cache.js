'use client';
import { useState, useTransition } from 'react';

/**
 * Answers of on-demand server actions (history, minutes, attendance, past meetings), kept in THIS browser tab's
 * memory for 3 minutes: opening the same thing again is instant, and nothing reaches the database. Never shared
 * between people or devices, gone when the app is reloaded / reopened. Only `ok` answers are kept.
 * Keys carry what changes them (e.g. a count), so a new minute or history line makes a new key; a write that
 * keeps the key (marking attendance) calls `forgetCached`.
 */
const TTL = 3 * 60 * 1000;
const store = new Map(); // key -> { at, promise, value }
const onServer = typeof window === 'undefined';

const fresh = (e) => e && Date.now() - e.at < TTL;

/** The answer for `key`: the kept one, the one already on its way, or a new call of `fetcher`. */
export function fetchCached(key, fetcher) {
    if (onServer) return fetcher();
    const e = store.get(key);
    if (fresh(e)) return e.promise;
    const entry = { at: Date.now(), value: undefined, promise: null };
    entry.promise = fetcher().then(
        (res) => {
            if (res?.ok) entry.value = res;
            else store.delete(key);
            return res;
        },
        (err) => {
            store.delete(key);
            throw err;
        },
    );
    store.set(key, entry);
    return entry.promise;
}

/** The kept answer for `key`, if it has arrived and is still fresh (synchronous). */
export function peekCached(key) {
    if (onServer) return undefined;
    const e = store.get(key);
    return fresh(e) ? e.value : undefined;
}

/** Drop kept answers whose key starts with `prefix` (after a write that changes them). */
export function forgetCached(prefix) {
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

/**
 * One on-demand part (a collapsed card): `prefetch` on intent (pointer over / touch / focus) starts the call early,
 * `load` on open shows the kept answer at once, else waits for it (`pending` = show the mini loader).
 * `res` is the action's answer ({ ok, … } or { error }), or null before the first load. A new `key` starts empty.
 * @param {string} key
 * @param {() => Promise<any>} fetcher
 */
export function useOnDemand(key, fetcher) {
    const [state, setState] = useState({ key, res: null });
    const [pending, start] = useTransition();
    const res = state.key === key ? state.res : null;
    const prefetch = () => {
        if (!peekCached(key)) fetchCached(key, fetcher).catch(() => {});
    };
    const load = () => {
        const hit = peekCached(key);
        if (hit) return setState({ key, res: hit });
        start(async () => {
            try {
                setState({ key, res: await fetchCached(key, fetcher) });
            } catch {
                setState({ key, res: { error: 'common.error' } });
            }
        });
    };
    return { res, pending, load, prefetch, loaded: res != null };
}
