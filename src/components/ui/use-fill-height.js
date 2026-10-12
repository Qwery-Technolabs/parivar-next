'use client';
import { useEffect, useRef } from 'react';

/**
 * A full-screen canvas (family tree, Nearby Homes map): the element it is put on grows down to the bottom of the
 * page area (#content — above the phone's bottom bar), leaving `gap` px. Measured live, since what sits above it
 * wraps differently on each screen. Keep a CSS height (e.g. h-[calc(100dvh-15rem)]) on it for the first paint.
 * @param {number} [gap] px left under it
 */
export default function useFillHeight(gap = 12) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const main = document.getElementById('content');
        if (!el || !main) return;
        const fit = () => {
            const h = main.getBoundingClientRect().bottom - (el.getBoundingClientRect().top + main.scrollTop) - gap;
            el.style.height = `${Math.max(320, Math.round(h))}px`;
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(main);
        window.addEventListener('resize', fit);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', fit);
        };
    }, [gap]);
    return ref;
}
