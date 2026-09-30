'use client';
import { Heart, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import Switch from '@/components/ui/switch';
import { age } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

function PersonCard({ p, isRoot, showDetails }) {
    const { t, locale } = useT();
    const name = (locale === 'gu' && p.full_name_local) || p.full_name;
    const a = age(p.dob);
    const tone = p.gender === 'female' ? 'border-t-rose-700' : p.gender === 'male' ? 'border-t-brand-navy' : 'border-t-surface-border';
    return (
        <Link
            href={`/members/${p.id}`}
            draggable={false}
            aria-current={isRoot ? 'true' : undefined}
            className={`block w-36 shrink-0 rounded-md border border-t-2 border-surface-border bg-white px-2.5 py-2 text-left shadow-sm hover:bg-accent ${tone} ${
                isRoot ? 'ring-2 ring-brand-orange' : ''
            } ${p.status === 'deceased' ? 'opacity-75' : ''}`}
        >
            <span className="block break-words text-sm font-medium leading-snug text-primary">{name}</span>
            {showDetails && (
                <span className="mt-0.5 block text-xs text-ink-gray">
                    {[a != null && `${a}`, p.marital_status && t(`family.marital.${p.marital_status}`), p.status === 'deceased' && t('family.late')]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                </span>
            )}
        </Link>
    );
}

const ZOOMS = [0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.3];

/**
 * The family tree as a canvas: every generation, oldest at the top, each person with their
 * spouse(s) beside them. Drag anywhere to move around (a drag never opens a card); − / 100% / +
 * zoom. The canvas scrolls inside its own box — a wide family never pushes the page.
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
        if (d?.moved) box.current.releasePointerCapture?.(e.pointerId);
        // A drag that ended on a card must not also open it.
        if (d?.moved) {
            const stop = (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
            };
            box.current.addEventListener('click', stop, { capture: true, once: true });
        }
    };

    const btn = 'inline-flex size-8 items-center justify-center rounded-md border border-surface-border bg-white text-primary hover:bg-accent disabled:opacity-40';
    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-gray">{t('family.dragHint')}</p>
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
                className="h-[calc(100dvh-13rem)] min-h-80 cursor-grab touch-pan-x touch-pan-y overflow-auto rounded-lg border border-surface-border bg-surface-login/60 shadow-inner select-none active:cursor-grabbing"
            >
                <div className="flex min-w-max flex-col items-center p-6" style={{ zoom: ZOOMS[zi] }}>
                    {tree.generations.map((row, gi) => (
                        <div key={gi} className="flex flex-col items-center">
                            {gi > 0 && <span aria-hidden className="h-6 w-px bg-ink-gray/40" />}
                            <div className={`flex justify-center gap-4 rounded-lg px-3 py-3 ${gi === tree.rootIndex ? 'bg-accent' : ''}`}>
                                {row.map((node) => (
                                    <div key={node.id} className="flex items-center gap-1.5">
                                        <PersonCard p={node} isRoot={node.id === tree.rootId} showDetails={showDetails} />
                                        {node.spouses.map((s) => (
                                            <div key={s.id} className="flex items-center gap-1.5">
                                                <Heart aria-label={t('relations.spouse')} className="size-3.5 shrink-0 text-rose-700" />
                                                <PersonCard p={s} isRoot={s.id === tree.rootId} showDetails={showDetails} />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
