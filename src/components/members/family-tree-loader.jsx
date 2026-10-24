'use client';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
const ready = new Map(); // url → data
function fetchPart(url) {
    if (!pending.has(url)) {
        const p = fetch(url).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        });
        p.then(
            (data) => ready.set(url, data),
            () => pending.delete(url), // a failure can be tried again
        );
        pending.set(url, p);
    }
    return pending.get(url);
}
const partUrl = (src, married, details) => `${src}${married ? '&married=1' : ''}${details ? '&details=1' : ''}`;

/**
 * Put the opened folded parts (very big families) into the tree. `get(kind, id)` = that part's data once here.
 *  - "See family" (`more` card, kind branch): its children come from the branch;
 *  - "See brothers" (`brothers` card, kind brothers): its parent's children come from the list (the card itself kept);
 * A part still loading marks its card (`loading` / `brothersLoading`); an open one `opened` / `brothersOpen`.
 * Unchanged nodes stay the same objects, so their cards don't re-render.
 */
function graft(node, open, get) {
    let kids = node.children;
    let changed = false;
    let mark = null;
    if (node.more && open.has(`branch:${node.id}`)) {
        const b = get('branch', node.id);
        if (b) {
            kids = b.node.children;
            mark = { opened: true };
        } else mark = { loading: true };
        changed = true;
    }
    const lineKid = kids.find((c) => c.brothers && open.has(`brothers:${c.id}`));
    if (lineKid) {
        const d = get('brothers', lineKid.id);
        kids = d
            ? d.children.map((x) => (x.keep ? { ...lineKid, brothersOpen: true } : x))
            : kids.map((c) => (c === lineKid ? { ...c, brothersLoading: true } : c));
        changed = true;
    }
    const mapped = kids.map((c) => graft(c, open, get));
    if (!changed && mapped.every((c, i) => c === kids[i])) return node;
    return { ...node, ...mark, children: mapped };
}

/** "See father": each loaded line of ancestors goes on top, the current top card hanging under it (in place of `keep`). */
function withFathers(top, ups, get) {
    for (const id of ups) {
        if (top.id !== id) break;
        const d = get('up', id);
        if (!d) return { ...top, upLoading: true };
        const below = top;
        const attach = (n) => ({ ...n, children: n.children.map((c) => (c.keep ? { ...below, up: false, brothers: c.brothers } : attach(c))) });
        top = attach(d.node);
    }
    return top;
}

/**
 * Loads the tree in parts (api/family-tree): first only what shows by default; turning on "Married daughters" or
 * "Details" fetches that part once — the tree on screen stays until it arrives (a spinner by the switches).
 * Very big families come folded: "See family" (&branch=<id>), "See brothers" (&brothers=<id>) and "See father"
 * (&up=<id>) fetch that part once and open it in place. There is no Hide: an opened part stays open until the page is
 * left (coming back starts folded again). After a switch, every opened part is fetched again for that switch — once.
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
    const [open, setOpen] = useState(() => new Set()); // opened parts: 'branch:<id>' | 'brothers:<id>'
    const [ups, setUps] = useState([]); // "See father" asked on these top cards, in order
    const [, setArrived] = useState(0); // a part arrived → graft again
    const want = partUrl(src, showMarried, showDetails);
    const urlOf = useCallback((kind, id) => `${want}&${kind}=${id}`, [want]);
    const parts = useMemo(() => [...[...open].map((k) => k.split(':')), ...ups.map((id) => ['up', String(id)])], [open, ups]);

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

    // Opened parts for the current switches (after a switch, each one is fetched again for it — once).
    useEffect(() => {
        let live = true;
        for (const [kind, id] of parts)
            if (!ready.has(urlOf(kind, id)))
                fetchPart(urlOf(kind, id)).then(
                    () => live && setArrived((n) => n + 1),
                    () => {
                        if (!live) return;
                        // Couldn't load: fold it back (the button can be tapped again).
                        if (kind === 'up') setUps((list) => list.slice(0, list.indexOf(Number(id))));
                        else
                            setOpen((s) => {
                                const next = new Set(s);
                                next.delete(`${kind}:${id}`);
                                return next;
                            });
                    },
                );
        return () => {
            live = false;
        };
    }, [parts, urlOf]);

    /** A card's button: kind 'branch' / 'brothers' / 'up' opens that part (no folding back). */
    const onToggle = useCallback((kind, id) => {
        if (kind === 'up') return setUps((list) => (list.includes(id) ? list : [...list, id]));
        setOpen((s) => {
            const next = new Set(s);
            const k = `${kind}:${id}`;
            if (next.has(k)) return s;
            next.add(k);
            return next;
        });
    }, []);

    // A part already here shows at once; otherwise the previous part of THIS tree stays while it loads.
    const base = ready.get(want) ?? (shown?.src === src ? shown.tree : null);
    const busy = !ready.has(want) && failed !== want;
    const loaded = parts.filter(([kind, id]) => ready.has(urlOf(kind, id))).join(',');
    const tree = useMemo(() => {
        if (!base || !parts.length) return base;
        const get = (kind, id) => ready.get(urlOf(kind, id));
        return { ...base, top: graft(withFathers(base.top, ups, get), open, get) };
        // `loaded` changes when a part arrives (they are kept outside React state).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base, parts, urlOf, loaded]);

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
    return (
        <FamilyTree
            tree={tree}
            showDetails={showDetails}
            showMarried={showMarried}
            onDetails={setShowDetails}
            onMarried={setShowMarried}
            onToggle={onToggle}
            busy={busy}
        />
    );
}
