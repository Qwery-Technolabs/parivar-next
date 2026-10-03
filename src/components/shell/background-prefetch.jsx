'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * After the first page has loaded, quietly fetch the main menu pages (whole page + data) so
 * opening them is instant — no loading screens anywhere (no loading.js by choice). Runs once per
 * app load (the shell stays mounted across navigations), when the browser is idle, one page at a
 * time, and never on Data Saver / 2G. Prefetched pages are kept for staleTimes.static
 * (next.config.mjs); any save on the server (revalidatePath) drops them early.
 * @param {{ hrefs: string[] }} props
 */
export default function BackgroundPrefetch({ hrefs }) {
    const router = useRouter();
    const done = useRef(false);
    useEffect(() => {
        if (done.current) return undefined;
        const conn = navigator.connection;
        if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) return undefined;
        const list = [...new Set(hrefs)].filter((h) => h && h !== window.location.pathname);
        const timers = [];
        const start = () => {
            done.current = true;
            list.forEach((href, i) => timers.push(setTimeout(() => router.prefetch(href), i * 300)));
        };
        const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 2000);
        return () => {
            if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
            clearTimeout(idle);
            timers.forEach(clearTimeout);
        };
    }, [hrefs, router]);
    return null;
}
