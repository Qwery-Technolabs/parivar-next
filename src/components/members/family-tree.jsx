'use client';
import { Flower2, Heart, Minus, Plus } from 'lucide-react';
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
 * One person in the tree: a round "photo" (their initial, navy for men, rose for women, grey when
 * late), the first name only — father's name and surname would repeat on every card — and one
 * detail line (age, or Late). The person whose tree it is gets an orange ring.
 */
function PersonTile({ p, isRoot, showDetails }) {
    const { t, locale } = useT();
    const local = locale !== 'en';
    const name = (local && (p.first_name_local || p.full_name_local)) || p.first_name || p.full_name;
    const fullName = (local && p.full_name_local) || p.full_name;
    const a = age(p.dob);
    const late = p.status === 'deceased';
    // Gradient "photos": navy for men, rose for women, grey for the late (with a flower).
    const face = late
        ? 'bg-linear-to-br from-gray-300 to-gray-500 text-white ring-white'
        : p.gender === 'female'
          ? 'bg-linear-to-br from-rose-400 to-rose-600 text-white ring-white'
          : p.gender === 'male'
            ? 'bg-linear-to-br from-[#30466a] to-brand-navy text-white ring-white'
            : 'bg-linear-to-br from-slate-300 to-slate-500 text-white ring-white';
    return (
        <Link
            href={`/members/${p.id}`}
            draggable={false}
            aria-current={isRoot ? 'true' : undefined}
            title={fullName}
            aria-label={fullName}
            className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-center transition-colors hover:bg-accent/70"
        >
            <span className="relative">
                <span
                    aria-hidden
                    className={`flex size-12 items-center justify-center rounded-full text-lg font-bold shadow-md ring-2 ${face} ${
                        isRoot ? 'outline-[3px] outline-offset-2 outline-brand-orange shadow-[0_0_0_7px_rgb(247_152_18/0.18)]' : ''
                    }`}
                >
                    {initialOf(name)}
                </span>
                {late && (
                    <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-surface-border bg-white" title={t('family.late')}>
                        <Flower2 aria-hidden className="size-3 text-gray-500" />
                    </span>
                )}
            </span>
            {isRoot && (
                <span className="rounded-full bg-brand-orange px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">{t('relations.you')}</span>
            )}
            <span className={`block max-w-full break-words text-[13px] font-semibold leading-tight ${late ? 'text-ink-gray' : 'text-primary'}`}>{name}</span>
            {showDetails && (
                <span className="block text-[11px] leading-none text-ink-gray tabular-nums">
                    {late ? t('family.late') : a != null ? `${a} ${t('matrimony.years')}` : '—'}
                </span>
            )}
        </Link>
    );
}

/**
 * A couple as ONE card — husband always on the left, wife on the right (whoever is the blood
 * relative), joined by a heart — or a single person's card. Children hang below, recursively.
 */
function Branch({ node, rootId, showDetails }) {
    const { t } = useT();
    const people = [node, ...node.spouses];
    // Men first (left), then women; order otherwise kept (e.g. a husband with two wives).
    const ordered = [...people.filter((p) => p.gender === 'male'), ...people.filter((p) => p.gender !== 'male')];
    return (
        <li>
            <div className="flex items-stretch rounded-2xl border border-white bg-linear-to-b from-white to-accent/70 shadow-[0_4px_14px_-4px_rgb(23_47_86/0.25)] ring-1 ring-surface-border/70 transition-transform hover:-translate-y-0.5">
                {ordered.map((p, i) => (
                    <div key={p.id} className="flex items-stretch">
                        {i > 0 && (
                            <span aria-hidden className="relative w-px bg-surface-border">
                                <span className="absolute top-[1.85rem] left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow ring-1 ring-rose-200">
                                    <Heart className="size-3.5 fill-rose-500 text-rose-500" aria-label={t('relations.spouse')} />
                                </span>
                            </span>
                        )}
                        <PersonTile p={p} isRoot={p.id === rootId} showDetails={showDetails} />
                    </div>
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

const ZOOMS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.3];

/**
 * The family line as a tree: the oldest recorded ancestor at the top, every descendant below —
 * couples side by side, children hanging under their parents, down to the youngest. The person
 * whose tree it is has an orange ring. Drag anywhere to move around (a drag never opens a card);
 * − / 100% / + zoom. The canvas scrolls inside its own box.
 */
export default function FamilyTree({ tree }) {
    const { t } = useT();
    const [showDetails, setShowDetails] = useState(true);
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
                className="h-[calc(100dvh-13rem)] min-h-80 cursor-grab touch-pan-x touch-pan-y overflow-auto rounded-xl border border-surface-border bg-[radial-gradient(circle,rgb(4_21_39/0.08)_1px,transparent_1px),radial-gradient(ellipse_at_top,rgb(247_152_18/0.10),transparent_60%),linear-gradient(to_bottom,#fbfaf7,#f4f5f9)] bg-size-[20px_20px,100%_100%,100%_100%] shadow-inner select-none active:cursor-grabbing"
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
