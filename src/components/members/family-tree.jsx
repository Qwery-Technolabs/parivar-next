'use client';
import { Flower2, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import Switch from '@/components/ui/switch';
import { age } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

/** First visible letter of a name (a whole grapheme — Gujarati vowel signs stay attached). */
function initialOf(name) {
    const text = String(name ?? '').trim();
    if (!text) return '?';
    try {
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return seg.segment(text)[Symbol.iterator]().next().value?.segment?.toUpperCase() ?? text[0];
    } catch {
        return Array.from(text)[0].toUpperCase();
    }
}

/**
 * One person: a square rounded "photo" tile (their initial on a navy / rose gradient; grey with a
 * flower when late) and the first name under it. How they are related to the tree's person
 * (Father, Kaka …) and their age are in the hover / long-press text; with Details on, the age
 * shows under the name. The tree's person has an orange ring.
 */
function PersonTile({ p, isRoot, showDetails }) {
    const { t, locale } = useT();
    const local = locale !== 'en';
    const name = (local && (p.first_name_local || p.full_name_local)) || p.first_name || p.full_name;
    const fullName = (local && p.full_name_local) || p.full_name;
    const a = age(p.dob);
    const late = p.status === 'deceased';
    const face = late
        ? 'from-gray-300 to-gray-500'
        : p.gender === 'female'
          ? 'from-rose-300 to-rose-500'
          : p.gender === 'male'
            ? 'from-[#4a6390] to-brand-navy'
            : 'from-slate-300 to-slate-500';
    const hover = [fullName, p.kin && t(`kin.terms.${p.kin}`), late ? t('family.late') : a != null ? `${a} ${t('matrimony.years')}` : null].filter(Boolean).join(' · ');
    return (
        <Link
            href={`/members/${p.id}`}
            draggable={false}
            aria-current={isRoot ? 'true' : undefined}
            title={hover}
            aria-label={hover}
            className="group flex w-[4.5rem] shrink-0 flex-col items-center text-center"
        >
            <span className="relative">
                <span
                    aria-hidden
                    className={`flex size-16 items-center justify-center rounded-xl bg-linear-to-br text-xl font-bold text-white/95 shadow-sm transition-transform group-hover:scale-[1.04] ${face} ${
                        isRoot ? 'ring-[3px] ring-brand-orange ring-offset-1' : ''
                    }`}
                >
                    {initialOf(name)}
                </span>
                {late && (
                    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-surface-border bg-white" title={t('family.late')}>
                        <Flower2 aria-hidden className="size-2.5 text-gray-500" />
                    </span>
                )}
            </span>
            <span className={`mt-1 line-clamp-1 max-w-full text-[11px] font-medium leading-tight ${late ? 'text-ink-gray' : 'text-ink'}`}>{name}</span>
            {showDetails && (late || a != null || p.kin) && (
                <span className="line-clamp-1 max-w-full text-[10px] leading-tight text-ink-gray">
                    {[p.kin && t(`kin.terms.${p.kin}`), late ? t('family.late') : a != null ? a : null].filter(Boolean).join(' · ')}
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
            <div className="flex items-start gap-1.5 rounded-2xl bg-white p-1.5 shadow-[0_2px_8px_-3px_rgb(15_23_42/0.18)] ring-1 ring-slate-200">
                {ordered.map((p) => (
                    <PersonTile key={p.id} p={p} isRoot={p.id === rootId} showDetails={showDetails} />
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

// A faint network of dots and lines behind the tree (tiles every 240px).
const NETWORK = `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none" stroke="#cbd5e1" stroke-width="0.8">' +
        '<path d="M20 30L90 70L60 150L20 30M90 70L170 40L210 110L140 130L90 70M140 130L60 150L110 220L140 130M210 110L200 200L110 220"/>' +
        '<g fill="#e2e8f0" stroke="none"><circle cx="20" cy="30" r="5"/><circle cx="90" cy="70" r="4"/><circle cx="60" cy="150" r="4"/><circle cx="170" cy="40" r="3"/><circle cx="210" cy="110" r="6"/><circle cx="140" cy="130" r="3"/><circle cx="110" cy="220" r="4"/><circle cx="200" cy="200" r="3"/></g>' +
        '</svg>',
)}")`;

const ZOOMS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.3];

/**
 * The family line as a tree: the oldest recorded ancestor at the top, every descendant below —
 * couples side by side, children hanging under their parents, down to the youngest. The person
 * whose tree it is has an orange ring. Drag anywhere to move around (a drag never opens a card);
 * − / 100% / + zoom. The canvas scrolls inside its own box.
 */
export default function FamilyTree({ tree }) {
    const { t } = useT();
    const [showDetails, setShowDetails] = useState(false);
    const [zi, setZi] = useState(ZOOMS.indexOf(1));
    const box = useRef(null);
    const drag = useRef(null);

    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop, moved: false };
    };
    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
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
    const onPointerUp = (e) => {
        const d = drag.current;
        drag.current = null;
        if (!d?.moved) return;
        box.current.releasePointerCapture?.(e.pointerId);
        // A drag that ended on a card must not also open it.
        const stop = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
        };
        box.current.addEventListener('click', stop, { capture: true, once: true });
    };

    const btn = 'inline-flex size-8 items-center justify-center rounded-md border border-surface-border bg-white text-primary hover:bg-accent disabled:opacity-40';
    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-3 text-xs text-ink-gray">
                    <span className="inline-flex items-center gap-1">
                        <span className="size-3 rounded-full bg-linear-to-br from-[#30466a] to-brand-navy" /> {t('gender.male')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="size-3 rounded-full bg-linear-to-br from-rose-400 to-rose-600" /> {t('gender.female')}
                    </span>
                    <span className="hidden sm:inline">· {t('family.dragHint')}</span>
                </p>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setZi((i) => Math.max(0, i - 1))} disabled={zi === 0} aria-label={t('family.zoomOut')} title={t('family.zoomOut')} className={btn}>
                            <Minus className="size-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setZi(ZOOMS.indexOf(1))}
                            title={t('family.zoomReset')}
                            className="h-8 min-w-14 rounded-md border border-surface-border bg-white px-2 text-xs font-medium text-primary tabular-nums hover:bg-accent"
                        >
                            {Math.round(ZOOMS[zi] * 100)}%
                        </button>
                        <button
                            type="button"
                            onClick={() => setZi((i) => Math.min(ZOOMS.length - 1, i + 1))}
                            disabled={zi === ZOOMS.length - 1}
                            aria-label={t('family.zoomIn')}
                            title={t('family.zoomIn')}
                            className={btn}
                        >
                            <Plus className="size-4" />
                        </button>
                    </div>
                    <Switch checked={showDetails} onChange={setShowDetails} label={t('members.details')} />
                </div>
            </div>
            <div
                ref={box}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => (drag.current = null)}
                style={{ backgroundImage: NETWORK, backgroundSize: '240px 240px' }}
                className="h-[calc(100dvh-13rem)] min-h-80 cursor-grab touch-pan-x touch-pan-y overflow-auto rounded-xl border border-surface-border bg-white shadow-inner select-none active:cursor-grabbing"
            >
                <div className="ftree inline-block min-w-full p-6" style={{ zoom: ZOOMS[zi] }}>
                    <ul>
                        <Branch node={tree.top} rootId={tree.rootId} showDetails={showDetails} />
                    </ul>
                </div>
            </div>
        </div>
    );
}
