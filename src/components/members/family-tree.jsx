'use client';
import { Flower2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Switch from '@/components/ui/switch';
import { age } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { birthName } from '@/lib/names';

/** Avatar silhouettes: a man, and a woman (longer hair). White on the tile. */
function ManIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden className={className}>
            <circle cx="32" cy="23" r="11" fill="currentColor" />
            <path d="M32 37c-11 0-19 6.5-19 15v4h38v-4c0-8.5-8-15-19-15z" fill="currentColor" />
        </svg>
    );
}
function WomanIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden className={className}>
            {/* hair falling to the shoulders, behind the face */}
            <path d="M32 9c-9 0-15 6.5-15 15.5 0 5 .8 9.5-2.5 14 3.5 1.2 7.5.6 10-1.2L32 38l7.5-.7c2.5 1.8 6.5 2.4 10 1.2-3.3-4.5-2.5-9-2.5-14C47 15.5 41 9 32 9z" fill="currentColor" opacity="0.85" />
            <circle cx="32" cy="24" r="10" fill="currentColor" />
            <path d="M32 38c-11 0-19 6.5-19 15v3h38v-3c0-8.5-8-15-19-15z" fill="currentColor" />
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
    const hover = [fullName, p.kin && t(`kin.terms.${p.kin}`), late ? t('family.late') : a != null ? `${a} ${t('matrimony.years')}` : null].filter(Boolean).join(' · ');
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
            <span className="-mt-0.5 block w-full truncate px-0.5 text-[10px] font-semibold leading-tight text-white">{name}</span>
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
function Branch({ node, rootId, showDetails }) {
    const people = [node, ...node.spouses];
    const ordered = [...people.filter((p) => p.gender === 'male'), ...people.filter((p) => p.gender !== 'male')];
    return (
        <li>
            <div className="flex items-stretch gap-[3px] rounded-xl bg-white p-[3px] shadow-[0_2px_8px_-3px_rgb(15_23_42/0.18)] ring-1 ring-slate-200">
                {ordered.map((p) => (
                    <PersonTile
                        key={p.id}
                        p={p}
                        isRoot={p.id === rootId}
                        showDetails={showDetails}
                        leaf={p.id === node.id && node.spouses.length === 0 && node.children.length === 0}
                        birth={p.id === node.id}
                    />
                ))}
            </div>
            {node.children.length > 0 && (
                <ul>
                    {node.children.map((c) => (
                        <Branch key={c.id} node={c} rootId={rootId} showDetails={showDetails} />
                    ))}
                </ul>
            )}
        </li>
    );
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;

/**
 * The family line as a tree: the oldest recorded ancestor at the top, every descendant below.
 * Inside the box: drag to move around (a drag never opens a card), pinch with two fingers to
 * zoom — on a laptop, pinch the trackpad or Ctrl + scroll. The zoom stays centred under the
 * fingers / pointer. No zoom buttons.
 */
export default function FamilyTree({ tree }) {
    const { t } = useT();
    const [showDetails, setShowDetails] = useState(false);
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const box = useRef(null);
    const drag = useRef(null);
    const pointers = useRef(new Map());
    const pinch = useRef(null);

    /** Zoom to `next`, keeping the point (cx, cy) — relative to the box — under the fingers. */
    const zoomTo = (next, cx, cy) => {
        const el = box.current;
        const z1 = zoomRef.current;
        const z2 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
        if (!el || Math.abs(z2 - z1) < 0.001) return;
        const left = (el.scrollLeft + cx) * (z2 / z1) - cx;
        const top = (el.scrollTop + cy) * (z2 / z1) - cy;
        zoomRef.current = z2;
        setZoom(z2);
        requestAnimationFrame(() => {
            el.scrollLeft = left;
            el.scrollTop = top;
        });
    };
    const local = (x, y) => {
        const r = box.current.getBoundingClientRect();
        return [x - r.left, y - r.top];
    };

    // Trackpad pinch (and Ctrl + wheel) arrive as wheel events with ctrlKey; plain scrolling stays native.
    useEffect(() => {
        const el = box.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomTo(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
        // zoomTo only reads refs; binding once is enough.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            // Second finger down: switch from dragging to pinching.
            const [a, b] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomRef.current };
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
                <Switch checked={showDetails} onChange={setShowDetails} label={t('members.details')} />
            </div>
            <div
                ref={box}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                className="h-[calc(100dvh-13rem)] min-h-80 cursor-grab touch-none overflow-auto overscroll-contain rounded-xl border border-surface-border bg-gray-100 shadow-inner select-none active:cursor-grabbing"
            >
                <div className="ftree inline-block min-w-full p-6" style={{ zoom }}>
                    <ul>
                        <Branch node={tree.top} rootId={tree.rootId} showDetails={showDetails} />
                    </ul>
                </div>
            </div>
        </div>
    );
}
