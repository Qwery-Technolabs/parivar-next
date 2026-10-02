'use client';
import { useEffect, useRef, useState } from 'react';

// Requests that run while someone types (debounced live search, local-script suggestions):
// no loader for these, it would flicker on every keystroke.
const QUIET = ['/api/transliterate', '/api/members/search'];
const SHOW_AFTER = 150; // ms — quick requests never show the line

/** A Next.js request worth showing: page data (RSC) and server actions — never prefetches. */
function isAppRequest(input, init) {
    let url;
    try {
        url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    } catch {
        return false;
    }
    if (url.origin !== window.location.origin) return false;
    if (QUIET.some((p) => url.pathname.startsWith(p))) return false;
    const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (h.get('next-router-prefetch')) return false;
    // RSC = navigation / router.refresh / router.replace; Next-Action = a server action (form save, button).
    return Boolean(h.get('rsc') || h.get('next-action')) || url.pathname.startsWith('/api/');
}

/**
 * The thin line across the top while the app waits on the server — opening a page, filtering,
 * saving, any action button. In the Samaj logo's colour (Settings → General). It watches the
 * app's own requests (window.fetch), so no page needs to opt in. Appears only after 150 ms,
 * creeps towards the end while waiting, then completes and fades out.
 */
export default function TopLoader({ color = '#b85d09' }) {
    const [phase, setPhase] = useState('idle'); // idle | loading | done
    const [width, setWidth] = useState(0);
    const pending = useRef(0);
    const phaseRef = useRef('idle'); // read in the fetch callbacks (state would be stale there)
    const showTimer = useRef(null);
    const trickle = useRef(null);
    const hideTimer = useRef(null);

    useEffect(() => {
        const begin = () => {
            pending.current += 1;
            if (pending.current > 1) return;
            clearTimeout(hideTimer.current);
            showTimer.current = setTimeout(() => {
                phaseRef.current = 'loading';
                setPhase('loading');
                setWidth(12);
                // Creep towards 90 %, slower the further it gets — never "done" until it is.
                trickle.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.08 : w)), 200);
            }, SHOW_AFTER);
        };
        const end = () => {
            pending.current = Math.max(0, pending.current - 1);
            if (pending.current > 0) return;
            clearTimeout(showTimer.current);
            clearInterval(trickle.current);
            if (phaseRef.current !== 'loading') return; // finished before the line ever showed
            phaseRef.current = 'done';
            setWidth(100);
            setPhase('done');
            hideTimer.current = setTimeout(() => {
                phaseRef.current = 'idle';
                setPhase('idle');
                setWidth(0);
            }, 300);
        };

        const original = window.fetch;
        window.fetch = function patched(input, init) {
            if (!isAppRequest(input, init)) return original.call(this, input, init);
            begin();
            return original.call(this, input, init).finally(end);
        };
        return () => {
            window.fetch = original;
            clearTimeout(showTimer.current);
            clearTimeout(hideTimer.current);
            clearInterval(trickle.current);
        };
    }, []);

    if (phase === 'idle') return null;
    return (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
            <div
                className="h-full rounded-r-full shadow-[0_0_6px_currentColor] transition-[width,opacity] duration-200 ease-out"
                style={{ width: `${width}%`, backgroundColor: color, color, opacity: phase === 'done' ? 0 : 1, transitionDuration: phase === 'done' ? '300ms' : '200ms' }}
            />
        </div>
    );
}
