'use client';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';

const Spinner = () => (
    <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-ink-gray" />
    </div>
);

// Lazy: the tree is only needed on this one route, so its code is split out of the
// shared bundle (it downloads alongside the data). `ssr:false` has to live in a client component (Next 16).
const FamilyTree = dynamic(() => import('./family-tree'), { ssr: false, loading: Spinner });

// Each part of a tree, fetched once while the app is open (the browser's own cache keeps it beyond, per version).
const pending = new Map(); // url → Promise
const ready = new Map(); // url → tree
function fetchPart(url) {
    if (!pending.has(url)) {
        const p = fetch(url).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        });
        p.then(
            (tree) => ready.set(url, tree),
            () => pending.delete(url), // a failure can be tried again
        );
        pending.set(url, p);
    }
    return pending.get(url);
}
const partUrl = (src, married, details) => `${src}${married ? '&married=1' : ''}${details ? '&details=1' : ''}`;

/**
 * Loads the tree in parts (api/family-tree): first only what shows by default; turning on "Married daughters" or
 * "Details" fetches that part once — the tree on screen stays until it arrives (a spinner by the switches).
 * `src`: the page's versioned address of this family's tree.
 */
export default function FamilyTreeLoader({ src }) {
    const { t } = useT();
    const [showDetails, setShowDetails] = useState(false);
    // Married daughters start hidden (only the person whose tree it is stays, even if she is one); the switch shows them.
    const [showMarried, setShowMarried] = useState(false);
    const [shown, setShown] = useState(null); // { src, tree } — the last part that arrived
    const [failed, setFailed] = useState(null); // url that failed
    const [attempt, setAttempt] = useState(0);
    const want = partUrl(src, showMarried, showDetails);

    useEffect(() => {
        let live = true;
        fetchPart(want).then(
            (tree) => live && setShown({ src, tree }),
            () => live && setFailed(want),
        );
        return () => {
            live = false;
        };
    }, [want, src, attempt]);

    // A part already here shows at once; otherwise the previous part of THIS tree stays while it loads.
    const tree = ready.get(want) ?? (shown?.src === src ? shown.tree : null);
    const busy = !ready.has(want) && failed !== want;

    if (!tree && failed === want)
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">
                {t('common.error')}
                <button
                    type="button"
                    onClick={() => {
                        setFailed(null);
                        setAttempt((n) => n + 1);
                    }}
                    className="rounded-md border border-surface-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                >
                    {t('common.tryAgain')}
                </button>
            </div>
        );
    if (!tree) return <Spinner />;
    return <FamilyTree tree={tree} showDetails={showDetails} showMarried={showMarried} onDetails={setShowDetails} onMarried={setShowMarried} busy={busy} />;
}
