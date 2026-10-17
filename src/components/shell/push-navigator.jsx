'use client';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * A tapped notification, with the app already open: the service worker (public/sw.js) focuses this window and posts
 * { type: 'pv-open', link } — we answer at once (so it does not fall back to a full reload) and go there with the
 * app's own router: no reload. Until the new page is up, a mini "Opening…" pill shows at the top (the 1px top line
 * alone is easy to miss right after switching to the app); it goes when the address changes, or after 10 s.
 */
export default function PushNavigator() {
    const router = useRouter();
    const { t } = useT();
    const pathname = usePathname();
    const search = useSearchParams();
    const [opening, setOpening] = useState(null); // the link being opened
    const timer = useRef(null);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        const onMessage = (e) => {
            const link = e.data?.type === 'pv-open' ? String(e.data.link ?? '') : '';
            // In-app paths only ("/x", never "//other-site").
            if (!link.startsWith('/') || link.startsWith('//')) return;
            e.ports?.[0]?.postMessage('ok');
            const here = window.location.pathname + window.location.search;
            if (link.split('#')[0] === here) return router.refresh(); // already there: just fresh data
            setOpening(link);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setOpening(null), 10000);
            router.push(link);
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => {
            navigator.serviceWorker.removeEventListener('message', onMessage);
            clearTimeout(timer.current);
        };
    }, [router]);

    // The new page is shown: the pill goes. (Setting state from the route change is the point of this effect.)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpening(null);
        clearTimeout(timer.current);
    }, [pathname, search]);

    if (!opening) return null;
    return (
        <div
            role="status"
            className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-50 flex justify-center"
        >
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-primary shadow-lg ring-1 ring-surface-border">
                <Loader2 className="size-3.5 animate-spin" /> {t('push.opening')}
            </span>
        </div>
    );
}
