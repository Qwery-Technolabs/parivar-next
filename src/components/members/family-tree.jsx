'use client';
import { Heart, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import Switch from '@/components/ui/switch';
import { age } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

function PersonCard({ p, isRoot, showDetails }) {
    const { t, locale } = useT();
    const name = (locale !== 'en' && p.full_name_local) || p.full_name;
    const a = age(p.dob);
    const late = p.status === 'deceased';
    // A thin top stripe says male / female at a glance (navy / rose); late relatives are muted.
    const tone = p.gender === 'female' ? 'border-t-rose-600' : p.gender === 'male' ? 'border-t-brand-navy' : 'border-t-surface-border';
    return (
        <Link
            href={`/members/${p.id}`}
            draggable={false}
            aria-current={isRoot ? 'true' : undefined}
            className={`block w-32 shrink-0 rounded-md border border-t-[3px] border-surface-border bg-white px-2 py-1.5 text-center shadow-sm transition-colors hover:bg-accent ${tone} ${
                isRoot ? 'ring-2 ring-brand-orange ring-offset-1' : ''
            } ${late ? 'bg-surface-login text-ink-gray' : ''}`}
        >
            <span className={`block break-words text-[13px] font-semibold leading-snug ${late ? 'text-ink-gray' : 'text-primary'}`}>{name}</span>
            {showDetails && (
                <span className="mt-0.5 block text-[11px] leading-tight text-ink-gray">
                    {[late ? t('family.late') : a != null && `${a} ${t('matrimony.years')}`, p.marital_status && !late && t(`family.marital.${p.marital_status}`)]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                </span>
            )}
        </Link>
    );
}

/** One couple (person + spouse(s)) and, below them, their children — recursively. */
function Branch({ node, rootId, showDetails }) {
    const { t } = useT();
    return (
        <li>
            <div className={`flex items-center gap-1 rounded-lg p-1 ${node.spouses.length ? 'border border-surface-border bg-white/70' : ''}`}>
                <PersonCard p={node} isRoot={node.id === rootId} showDetails={showDetails} />
                {node.spouses.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                        <Heart aria-label={t('relations.spouse')} className="size-3.5 shrink-0 fill-rose-600 text-rose-600" />
                        <PersonCard p={s} isRoot={s.id === rootId} showDetails={showDetails} />
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
                        <span className="h-2 w-4 rounded-sm bg-brand-navy" /> {t('gender.male')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-4 rounded-sm bg-rose-600" /> {t('gender.female')}
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
                className="h-[calc(100dvh-13rem)] min-h-80 cursor-grab touch-pan-x touch-pan-y overflow-auto rounded-lg border border-surface-border bg-[radial-gradient(circle,rgb(4_21_39/0.07)_1px,transparent_1px)] bg-size-[18px_18px] shadow-inner select-none active:cursor-grabbing"
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
