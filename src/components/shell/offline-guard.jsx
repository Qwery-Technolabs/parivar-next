'use client';
import { WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

// The browser's online / offline state, as a store (no setState in an effect).
function subscribe(cb) {
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
    };
}
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

/**
 * While the connection is down: every click / tap is paused (a transparent layer over the whole page —
 * nothing half-sends, no "network changed" error screens from a tap) and a small notice says so. When
 * it comes back: "Back online", clicks work again and the page quietly refreshes its data. In the root
 * layout, so the app and the public pages both have it.
 */
export default function OfflineGuard() {
    const { t } = useT();
    const router = useRouter();
    const online = useSyncExternalStore(subscribe, getOnline, getServerOnline);

    // Back online: say so, and bring the page up to date (whatever changed meanwhile).
    useEffect(() => {
        const back = () => {
            toast.success(t('offline.back'));
            router.refresh();
        };
        window.addEventListener('online', back);
        return () => window.removeEventListener('online', back);
    }, [router, t]);

    if (online) return null;
    return (
        <>
            {/* Pauses every click and tap until the connection is back. */}
            <div aria-hidden className="fixed inset-0 z-[100] cursor-not-allowed bg-white/30" />
            <div
                role="status"
                aria-live="assertive"
                className="fixed inset-x-0 bottom-4 z-[101] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-900 shadow-lg"
            >
                <WifiOff className="size-5 shrink-0 animate-pulse" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{t('offline.title')}</p>
                    <p className="text-xs">{t('offline.body')}</p>
                </div>
            </div>
        </>
    );
}
