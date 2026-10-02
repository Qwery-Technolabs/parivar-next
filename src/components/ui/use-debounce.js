'use client';
import { useEffect, useMemo, useRef } from 'react';

/** The one wait for every search / suggestion field: act 300 ms after the person stops typing. */
export const DEBOUNCE_MS = 300;

/**
 * Debounce a callback: calling it again within `delay` restarts the wait, so `fn` runs once,
 * with the last arguments, after typing pauses. Always calls the LATEST `fn` (no stale state).
 * The returned function has `.cancel()`; a pending call is dropped on unmount.
 * Use it for every search box, picker or suggestion that reacts to typing.
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} [delay]
 * @returns {F & { cancel: () => void }}
 */
export function useDebouncedCallback(fn, delay = DEBOUNCE_MS) {
    const fnRef = useRef(fn);
    const timer = useRef(null);
    useEffect(() => {
        fnRef.current = fn;
    });
    useEffect(() => () => clearTimeout(timer.current), []);
    return useMemo(() => {
        const run = (...args) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => fnRef.current(...args), delay);
        };
        run.cancel = () => clearTimeout(timer.current);
        return run;
    }, [delay]);
}
