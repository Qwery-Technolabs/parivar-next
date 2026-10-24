'use client';
import { ArrowUp, ChevronUp, Flower2, Focus, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { memo, useEffect, useRef } from 'react';
import Switch from '@/components/ui/switch';
import useFillHeight from '@/components/ui/use-fill-height';
import { age } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { birthName } from '@/lib/names';

/**
 * Avatar silhouettes: a man, and a woman (longer hair). White on the tile. Drawn ONCE as hidden <symbol>s
 * (FigureDefs, in the tree); every tile and the legend re-use them — far fewer elements in a big tree.
 */
function FigureDefs() {
    return (
        <svg aria-hidden width="0" height="0" className="absolute">
            <symbol id="ft-man" viewBox="0 0 64 64">
                <circle cx="32" cy="23" r="11" fill="currentColor" />
                <path d="M32 37c-11 0-19 6.5-19 15v4h38v-4c0-8.5-8-15-19-15z" fill="currentColor" />
            </symbol>
            <symbol id="ft-woman" viewBox="0 0 64 64">
                {/* hair falling to the shoulders, behind the face */}
                <path
                    d="M32 9c-9 0-15 6.5-15 15.5 0 5 .8 9.5-2.5 14 3.5 1.2 7.5.6 10-1.2L32 38l7.5-.7c2.5 1.8 6.5 2.4 10 1.2-3.3-4.5-2.5-9-2.5-14C47 15.5 41 9 32 9z"
                    fill="currentColor"
                    opacity="0.85"
                />
                <circle cx="32" cy="24" r="10" fill="currentColor" />
                <path d="M32 38c-11 0-19 6.5-19 15v3h38v-3c0-8.5-8-15-19-15z" fill="currentColor" />
            </symbol>
        </svg>
    );
}
function ManIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden className={className}>
            <use href="#ft-man" />
        </svg>
    );
}
function WomanIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden className={className}>
            <use href="#ft-woman" />
        </svg>
    );
}

/**
 * One person: a square rounded "photo" tile (their initial on a navy / rose gradient; grey with a
 * flower when late) and the first name under it. How they are related to the tree's person
 * (Father, Kaka …) and their age are in the hover / long-press text; with Details on, the age
 * shows under the name. The tree's person has an orange ring.
 */
function PersonTile({ p, isRoot, showDetails, leaf = false, birth = false }) {
    const { t, locale } = useT();
    const local = locale !== 'en';
    const name = (local && (p.first_name_local || p.full_name_local)) || p.first_name || p.full_name;
    // A daughter in her father's line goes by her maiden name; a wife (spouse) by her married name.
    const fullName = (birth && birthName(p, local)) || (local && p.full_name_local) || p.full_name;
    const a = age(p.dob);
    const late = p.status === 'deceased';
    // Same tile colour for men and women — the figure tells them apart; late relatives are grey.
    const face = late ? 'from-gray-300 to-gray-500' : 'from-[#4a6390] to-brand-navy';
    const Figure = p.gender === 'female' ? WomanIcon : ManIcon;
    const hover = [fullName, p.kin && t(`kin.terms.${p.kin}`), late ? t('family.late') : a != null ? `${a} ${t('matrimony.years')}` : null]
        .filter(Boolean)
        .join(' · ');
    // One coloured tile: the figure fills it (2–4px edge) and the name sits inside it in white.
    return (
        <Link
            href={`/members/${p.id}`}
            draggable={false}
            aria-current={isRoot ? 'true' : undefined}
            title={hover}
            aria-label={hover}
            className={`group relative flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-lg bg-linear-to-br p-[3px] text-center text-white shadow-sm transition-transform hover:scale-[1.04] ${face} ${
                isRoot ? 'ring-[1.5px] ring-brand-orange ring-offset-1' : ''
            }`}
        >
            <Figure className="size-12 text-white/90" />
            <span className="-mt-0.5 block w-full truncate px-0.5 text-[10px] font-medium leading-tight text-white">{name}</span>
            {/* Details: always two lines (blank when empty) so every tile in a row is the same height. */}
            {showDetails && (
                <span className="block h-3 w-full truncate px-0.5 text-[9px] leading-3 text-white/80">
                    {[p.kin && t(`kin.terms.${p.kin}`), late ? t('family.late') : a != null ? a : null].filter(Boolean).join(' · ') || '\u00a0'}
                </span>
            )}
            {/* The end of a line (no spouse, no children): Details also says whether they are married yet. */}
            {showDetails && (
                <span className="block h-3 w-full truncate px-0.5 text-[9px] font-semibold leading-3 text-orange-200">
                    {leaf && !late && p.marital_status ? t(`family.marital.${p.marital_status}`) : '\u00a0'}
                </span>
            )}
            {late && (
                <span className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-white/90" title={t('family.late')}>
                    <Flower2 aria-hidden className="size-2.5 text-gray-500" />
                </span>
            )}
        </Link>
    );
}

/**
 * A couple in one light card — husband always left, wife right — or a single person's card.
 * Children hang below from the middle of the card (lines in globals.css .ftree).
 */
/** A daughter who has married (married-like status or a recorded husband) — worked out by the server (`md`). */
const marriedDaughter = (n) => Boolean(n.md);

// memo: a branch re-renders only when its own data or a switch changes (never while dragging or zooming).
/** A small pill under / beside a card: See family · See brothers · See father (spinner while its part loads). */
function FoldButton({ icon: Icon, label, busy, onClick, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border border-surface-border bg-white px-2.5 text-[11px] font-medium text-primary shadow-sm hover:bg-accent disabled:opacity-70 ${className}`}
        >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />} {label}
        </button>
    );
}

const Branch = memo(function Branch({ node, rootId, showDetails, onToggle, top = false }) {
    const { t } = useT();
    // A married daughter in her father's line (not the tree's top): she comes first, her husband beside her on the
    // right. Which children show (married daughters, their branches, folded parts) is already decided by the server
    // (lib/family familyTreeData) for the chosen switches.
    const outMarried = !top && marriedDaughter(node);
    const kids = node.children;
    const people = [node, ...node.spouses];
    const ordered = outMarried ? people : [...people.filter((p) => p.gender === 'male'), ...people.filter((p) => p.gender !== 'male')];
    const folds = node.more && !node.opened;
    return (
        <li>
            {/* Top card with a known father above (very big families): load the next ancestors. */}
            {node.up && (
                <FoldButton icon={ArrowUp} label={t('family.seeFather')} busy={node.upLoading} onClick={() => onToggle('up', node.id)} className="mb-2" />
            )}
            <div className="relative">
                {/* Brothers not sent (an ancestor in a long line): beside the card, on its left. */}
                {node.brothers && (
                    <FoldButton
                        icon={node.brothersOpen ? ChevronUp : Users}
                        label={node.brothersOpen ? t('family.hideBranch') : t('family.seeBrothers')}
                        busy={node.brothersLoading}
                        onClick={() => onToggle('brothers', node.id)}
                        className="absolute top-1/2 right-full mr-2 -translate-y-1/2"
                    />
                )}
                <div className="flex items-stretch gap-[3px] rounded-xl bg-white p-[3px] shadow-[0_2px_8px_-3px_rgb(15_23_42/0.18)] ring-1 ring-slate-200">
                    {ordered.map((p) => (
                        <PersonTile
                            key={p.id}
                            p={p}
                            isRoot={p.id === rootId}
                            showDetails={showDetails}
                            leaf={p.id === node.id && node.spouses.length === 0 && kids.length === 0 && !node.more}
                            birth={p.id === node.id}
                        />
                    ))}
                </div>
                {/* An opened "See family": fold it again from the card's bottom edge. */}
                {node.opened && (
                    <button
                        type="button"
                        onClick={() => onToggle('branch', node.id)}
                        aria-label={t('family.hideBranch')}
                        title={t('family.hideBranch')}
                        className="absolute -bottom-3 left-1/2 z-10 inline-flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-surface-border bg-white text-primary shadow-sm hover:bg-accent"
                    >
                        <ChevronUp className="size-3.5" />
                    </button>
                )}
            </div>
            {/* Children not sent (very big families): only a card with at least one child gets the button. */}
            {folds && (
                <FoldButton icon={Users} label={t('family.seeFamily')} busy={node.loading} onClick={() => onToggle('branch', node.id)} className="mt-2" />
            )}
            {kids.length > 0 && (
                <ul>
                    {kids.map((c) => (
                        <Branch key={c.id} node={c} rootId={rootId} showDetails={showDetails} onToggle={onToggle} />
                    ))}
                </ul>
            )}
        </li>
    );
});

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;

/**
 * The family line as a tree: the oldest recorded ancestor at the top, every descendant below.
 * Inside the box: drag to move around (a drag never opens a card), pinch with two fingers to
 * zoom — on a laptop, pinch the trackpad or Ctrl + scroll. The zoom stays centred under the
 * fingers / pointer. No zoom buttons.
 * Zoom is written straight onto the tree (style.zoom — crisp, re-laid out by the browser), at most once per frame,
 * never through React state — so pinching never re-renders the cards.
 * The switches and the data parts come from family-tree-loader (`busy` while a switch's part downloads).
 */
export default function FamilyTree({ tree, showDetails, showMarried, onDetails, onMarried, onToggle, busy = false }) {
    const { t } = useT();
    const zoomRef = useRef(1);
    const want = useRef(null); // { z, cx, cy } waiting for the next frame
    const zoomFrame = useRef(0);
    const inner = useRef(null);
    const box = useRef(null);
    // The canvas reaches the bottom edge of the page.
    const fill = useFillHeight();
    const drag = useRef(null);
    const pointers = useRef(new Map());
    const pinch = useRef(null);

    /** Zoom to `next`, keeping the point (cx, cy) — relative to the box — under the fingers. Applied once per frame. */
    const zoomTo = (next, cx, cy) => {
        want.current = { z: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)), cx, cy };
        if (zoomFrame.current) return;
        zoomFrame.current = requestAnimationFrame(() => {
            zoomFrame.current = 0;
            const w = want.current;
            want.current = null;
            const el = box.current;
            const z1 = zoomRef.current;
            if (!w || !el || !inner.current || Math.abs(w.z - z1) < 0.001) return;
            const left = (el.scrollLeft + w.cx) * (w.z / z1) - w.cx;
            const top = (el.scrollTop + w.cy) * (w.z / z1) - w.cy;
            zoomRef.current = w.z;
            inner.current.style.zoom = String(w.z);
            el.scrollLeft = left;
            el.scrollTop = top;
        });
    };
    /** The zoom about to be shown (a frame may be waiting). */
    const nextZoom = () => want.current?.z ?? zoomRef.current;
    const local = (x, y) => {
        const r = box.current.getBoundingClientRect();
        return [x - r.left, y - r.top];
    };

    // Trackpad pinch (and Ctrl + wheel) arrive as wheel events with ctrlKey; plain scrolling stays native.
    // Open on the person whose tree this is: scroll their tile (aria-current) to the middle of the box,
    // instead of starting at the top-left with the oldest ancestor.
    /** Bring the person whose tree it is (their tile, aria-current) to the middle of the box. */
    const centerOnRoot = (smooth = false) => {
        const el = box.current;
        const tile = el?.querySelector('[aria-current="true"]');
        if (!el || !tile) return;
        const b = el.getBoundingClientRect();
        const r = tile.getBoundingClientRect();
        el.scrollTo({
            left: el.scrollLeft + r.left + r.width / 2 - (b.left + b.width / 2),
            top: el.scrollTop + r.top + r.height / 2 - (b.top + b.height / 2),
            behavior: smooth ? 'smooth' : 'auto',
        });
    };
    useEffect(() => {
        centerOnRoot();
    }, [tree.rootId]);

    useEffect(() => {
        const el = box.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomTo(nextZoom() * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            cancelAnimationFrame(zoomFrame.current);
            zoomFrame.current = 0;
        };
        // zoomTo only reads refs; binding once is enough.
    }, []);

    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            // Second finger down: switch from dragging to pinching.
            const [a, b] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: nextZoom() };
            drag.current = { ...(drag.current ?? {}), moved: true, pinching: true };
            return;
        }
        drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop, moved: false };
    };
    const onPointerMove = (e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            const [cx, cy] = local((a.x + b.x) / 2, (a.y + b.y) / 2);
            zoomTo(pinch.current.zoom * (dist / pinch.current.dist), cx, cy);
            return;
        }
        const d = drag.current;
        if (!d || d.pinching) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) {
            d.moved = true;
            box.current.setPointerCapture?.(e.pointerId);
        }
        if (d.moved) {
            box.current.scrollLeft = d.left - dx;
            box.current.scrollTop = d.top - dy;
        }
    };
    const onPointerEnd = (e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        if (pointers.current.size > 0) return; // still a finger down
        const d = drag.current;
        drag.current = null;
        if (!d?.moved) return;
        box.current.releasePointerCapture?.(e.pointerId);
        // A drag or pinch that ended on a card must not also open it.
        const stop = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
        };
        box.current.addEventListener('click', stop, { capture: true, once: true });
    };

    return (
        <div>
            <FigureDefs />
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-3 text-xs text-ink-gray">
                    <span className="inline-flex items-center gap-1">
                        <ManIcon className="size-4 text-brand-navy" /> {t('gender.male')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <WomanIcon className="size-4 text-brand-navy" /> {t('gender.female')}
                    </span>
                    <span className="hidden sm:inline">· {t('family.gestureHint')}</span>
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    {/* A switch's part of the tree is fetched once — a spinner while it comes. */}
                    {busy && <Loader2 aria-hidden className="size-4 animate-spin text-ink-gray" />}
                    <Switch checked={showMarried} onChange={onMarried} label={t('family.marriedDaughters')} />
                    <Switch checked={showDetails} onChange={onDetails} label={t('members.details')} />
                </div>
            </div>
            <div ref={fill} className="relative h-[calc(100dvh-13rem)] min-h-80">
                <div
                    ref={box}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerEnd}
                    onPointerCancel={onPointerEnd}
                    className="h-full cursor-grab touch-none overflow-auto overscroll-contain rounded-xl border border-surface-border bg-gray-100 shadow-inner select-none active:cursor-grabbing"
                >
                    {/* No React style here: the zoom is set on this element directly (zoomTo). */}
                    <div ref={inner} className="ftree inline-block min-w-full p-6">
                        <ul>
                            <Branch node={tree.top} rootId={tree.rootId} showDetails={showDetails} onToggle={onToggle} top />
                        </ul>
                    </div>
                </div>
                {/* Back to this person: their card moves to the middle of the box. */}
                <button
                    type="button"
                    onClick={() => centerOnRoot(true)}
                    aria-label={t('family.focusPerson')}
                    title={t('family.focusPerson')}
                    className="absolute bottom-3 right-3 inline-flex size-10 items-center justify-center rounded-lg border border-surface-border bg-white text-primary shadow-md hover:bg-accent"
                >
                    <Focus className="size-5" />
                </button>
            </div>
        </div>
    );
}
