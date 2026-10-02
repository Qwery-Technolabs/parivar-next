'use client';
import { ChevronsDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { kinTerm } from '@/lib/kinship';
import { birthName } from '@/lib/names';

/** First visible letter (whole grapheme, so Gujarati vowel signs stay attached). */
function initialOf(name) {
    const text = String(name ?? '').trim();
    if (!text) return '?';
    try {
        return new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next().value.segment.toUpperCase();
    } catch {
        return Array.from(text)[0].toUpperCase();
    }
}

const ordinal = (n) => {
    const v = n % 100;
    const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
    return `${n}${suffix}`;
};

const STEP_PX = 26; // indent per generation away from the viewer
const MAX_LEVEL = 4;
const AVATAR_X = 30; // avatar centre from the card's left edge (12px padding + half of 36px)
const LINK_H = 34; // height of the joint between two cards

/**
 * The joint between two cards: a curve from under the previous avatar to over the next one —
 * top-left → bottom-right when the chain moves a generation further away, top-right →
 * bottom-left when it comes back, straight down when it stays — with the step written beside it.
 */
function Joint({ fromX, toX, label }) {
    const right = Math.max(fromX, toX);
    const d = fromX === toX ? `M ${fromX} 0 L ${toX} ${LINK_H}` : `M ${fromX} 0 C ${fromX} ${LINK_H / 2}, ${toX} ${LINK_H / 2}, ${toX} ${LINK_H}`;
    return (
        <div className="relative" style={{ height: LINK_H }}>
            <svg aria-hidden className="absolute inset-y-0 left-0 overflow-visible text-slate-400" width={right + 4} height={LINK_H}>
                <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <circle cx={fromX} cy="1.5" r="2.5" fill="currentColor" />
                <circle cx={toX} cy={LINK_H - 1.5} r="2.5" fill="currentColor" />
            </svg>
            <span className="absolute top-1/2 -translate-y-1/2 text-xs text-ink-gray" style={{ left: right + 12 }}>
                {label}
            </span>
        </div>
    );
}

const COLLAPSE_OVER = 6;

/**
 * How the person is related to the viewer, as a chain: You → 's father X → 's father Y → …
 * Each person shows what they are to the viewer (Father, Dada, Kaka …) and their generation
 * ("2nd generation above", "Same generation"). Cards step right by how many generations away
 * they are; the joints curve from avatar to avatar. A long chain folds its middle behind
 * "Show N more". A summary names the relation when there is a word for it.
 * `path`: { chain: [{ person: {id, full_name, full_name_local, gender, status, village}, step }], steps }.
 */
export default function RelationChain({ path }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const married = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    // Reached as someone's daughter or sister she is in her father's family: maiden name there.
    const nameFor = (r) => ((r.step === 'daughter' || r.step === 'sister') && birthName(r.person, locale !== 'en')) || married(r.person);
    const name = married;
    const term = kinTerm(path.steps);
    const target = path.chain.at(-1).person;

    const delta = (step) => (step === 'father' || step === 'mother' ? 1 : step === 'son' || step === 'daughter' ? -1 : 0);
    const rows = path.chain.reduce((acc, { person, step }, i) => {
        const gen = i === 0 ? 0 : acc[i - 1].gen + delta(step);
        const indent = Math.min(Math.abs(gen), MAX_LEVEL) * STEP_PX;
        return [...acc, { person, step, gen, i, indent, kin: i === 0 ? null : kinTerm(path.steps.slice(0, i)) }];
    }, []);
    const collapsed = !open && rows.length > COLLAPSE_OVER;
    const shown = collapsed ? [...rows.slice(0, 2), null, ...rows.slice(-2)] : rows;
    const hidden = rows.length - 4;
    const genLabel = (gen) => {
        if (gen === 0) return t('kin.sameGen');
        const n = Math.abs(gen);
        return t(gen > 0 ? 'kin.genAbove' : 'kin.genBelow', { ord: ordinal(n), n });
    };

    return (
        <div className="p-3">
            {term && (
                <p className="mb-3 rounded-md bg-accent px-3 py-2 text-sm text-primary">{t('kin.summary', { name: name(target), term: t(`kin.terms.${term}`) })}</p>
            )}
            <ol>
                {shown.map((r, idx) => {
                    if (r === null) {
                        const prev = shown[idx - 1];
                        return (
                            <li key="more" className="relative py-1" style={{ paddingLeft: prev.indent + AVATAR_X - 6 }}>
                                <span aria-hidden className="absolute inset-y-0 w-0 border-l-2 border-dashed border-slate-300" style={{ left: prev.indent + AVATAR_X - 1 }} />
                                <button
                                    type="button"
                                    onClick={() => setOpen(true)}
                                    className="relative ml-4 inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent"
                                >
                                    <ChevronsDown className="size-3.5" /> {t('kin.showMore', { count: hidden })}
                                </button>
                            </li>
                        );
                    }
                    const prev = idx > 0 ? shown[idx - 1] : null;
                    const from = prev ?? (idx > 1 ? shown[idx - 2] : null);
                    return (
                        <li key={r.person.id}>
                            {r.step && from && <Joint fromX={from.indent + AVATAR_X} toX={r.indent + AVATAR_X} label={t(`kin.step.${r.step}`)} />}
                            <Link
                                href={`/members/${r.person.id}`}
                                style={{ marginLeft: r.indent }}
                                className="flex items-center gap-3 rounded-lg border border-surface-border bg-white px-3 py-2 shadow-sm hover:bg-accent/60"
                            >
                                <span
                                    aria-hidden
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white shadow ${
                                        r.person.status === 'deceased' ? 'from-gray-300 to-gray-500' : 'from-[#4a6390] to-brand-navy'
                                    }`}
                                >
                                    {initialOf(nameFor(r))}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                                        <span className="truncate text-sm font-semibold text-primary">{nameFor(r)}</span>
                                        {r.i === 0 && <span className="text-xs font-medium text-brand-orange-strong">({t('kin.you')})</span>}
                                        {r.kin && <span className="rounded bg-accent px-1.5 py-px text-[10px] font-semibold text-primary">{t(`kin.terms.${r.kin}`)}</span>}
                                    </span>
                                    <span className="block truncate text-xs text-ink-gray">
                                        {[
                                            r.person.gender && t(`gender.${r.person.gender}`),
                                            r.i > 0 && genLabel(r.gen),
                                            r.person.status === 'deceased' && t('family.late'),
                                            r.person.village,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
