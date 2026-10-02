'use client';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { unstable_isUnrecognizedActionError as isStaleAction } from 'next/navigation';
import { useEffect } from 'react';
import { useT } from '@/lib/i18n/client';

// Next 16 error boundaries receive `retry` (re-fetch + re-render), not `reset`.
// A page left open across a deploy still holds the OLD server-action ids; using a menu item or button
// then fails with "Server Action … was not found on the server". That is not a real error: load the
// new version once (a page reload), and the person can simply tap again. Guarded so it never loops.
const RELOAD_KEY = 'pv-stale-reload';
export default function AppError({ error, retry }) {
    const { t } = useT();
    const stale = isStaleAction(error);
    useEffect(() => {
        if (stale) {
            let last = 0;
            try {
                last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
                if (Date.now() - last > 30000) sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
            } catch {
                // Storage blocked: still reload once.
            }
            if (Date.now() - last > 30000) {
                window.location.reload();
                return;
            }
        }
        console.error(error);
    }, [error, stale]);

    return (
        <div className="mx-auto mt-10 max-w-md rounded-lg border border-surface-border bg-white p-6 text-center shadow-sm">
            <TriangleAlert className="mx-auto size-6 text-destructive" />
            <h1 className="mt-2 text-base font-semibold text-primary">{t('errors.title')}</h1>
            <p className="mt-1 text-sm text-ink-gray">{t('common.error')}</p>
            {error?.digest && <p className="mt-2 font-mono text-[11px] text-ink-gray">{error.digest}</p>}
            <button
                type="button"
                onClick={() => retry()}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
                <RotateCcw className="size-4" /> {t('common.tryAgain')}
            </button>
        </div>
    );
}
