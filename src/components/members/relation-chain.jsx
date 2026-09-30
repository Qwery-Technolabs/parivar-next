'use client';
import { ChevronsDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { kinTerm } from '@/lib/kinship';

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

/** The small wavy link between two people, with the step beside it ("'s father" / "ના પિતા"). */
function Step({ label, indent }) {
    return (
        <div className={`flex items-center gap-1.5 py-0.5 ${indent ? 'pl-9' : 'pl-4'}`}>
            <svg aria-hidden width="18" height="24" viewBox="0 0 18 24" className="shrink-0 text-slate-400">
                <circle cx="4" cy="3" r="2.5" fill="currentColor" />
                <path d="M4 5 C 4 13, 14 9, 14 17 L 14 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-ink-gray">{label}</span>
        </div>
    );
}

const COLLAPSE_OVER = 6;

/**
 * How the person is related to the viewer, as a chain: You → 's father X → 's sister Y → …
 * People in another generation than the viewer are indented (a "tab"); the same generation stays
 * aligned and is tagged. A long chain folds its middle behind "Show N more". A summary names the
 * relation when there is a word for it (Fuva / ફુવા).
 * `path`: { chain: [{ person: {id, full_name, full_name_local, gender, status, village}, step }], steps }.
 */
export default function RelationChain({ path }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const term = kinTerm(path.steps);
    const target = path.chain.at(-1).person;

    // Generation of each person relative to the viewer: parents +1, children −1, the rest level.
    const delta = (step) => (step === 'father' || step === 'mother' ? 1 : step === 'son' || step === 'daughter' ? -1 : 0);
    const rows = path.chain.reduce((acc, { person, step }, i) => {
        const gen = i === 0 ? 0 : acc[i - 1].gen + delta(step);
        return [...acc, { person, step, gen, i }];
    }, []);
    const collapsed = !open && rows.length > COLLAPSE_OVER;
    const shown = collapsed ? [...rows.slice(0, 2), null, ...rows.slice(-2)] : rows;
    const hidden = rows.length - 4;

    return (
        <div className="p-3">
            {term && (
                <p className="mb-3 rounded-md bg-accent px-3 py-2 text-sm text-primary">{t('kin.summary', { name: name(target), term: t(`kin.terms.${term}`) })}</p>
            )}
            <ol>
                {shown.map((r) =>
                    r === null ? (
                        <li key="more" className="py-1 pl-4">
                            <button
                                type="button"
                                onClick={() => setOpen(true)}
                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent"
                            >
                                <ChevronsDown className="size-3.5" /> {t('kin.showMore', { count: hidden })}
                            </button>
                        </li>
                    ) : (
                        <li key={r.person.id}>
                            {r.step && <Step label={t(`kin.step.${r.step}`)} indent={r.gen !== 0} />}
                            <Link
                                href={`/members/${r.person.id}`}
                                className={`flex items-center gap-3 rounded-lg border border-surface-border bg-white px-3 py-2 shadow-sm hover:bg-accent/60 ${
                                    r.gen !== 0 ? 'ml-6' : ''
                                }`}
                            >
                                <span
                                    aria-hidden
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white shadow ${
                                        r.person.status === 'deceased' ? 'from-gray-300 to-gray-500' : 'from-[#4a6390] to-brand-navy'
                                    }`}
                                >
                                    {initialOf(name(r.person))}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-primary">
                                        {name(r.person)}
                                        {r.i === 0 && <span className="ml-1.5 text-xs font-medium text-brand-orange-strong">({t('kin.you')})</span>}
                                    </span>
                                    <span className="block truncate text-xs text-ink-gray">
                                        {[
                                            r.person.gender && t(`gender.${r.person.gender}`),
                                            r.i > 0 && r.gen === 0 && t('kin.sameGen'),
                                            r.person.status === 'deceased' && t('family.late'),
                                            r.person.village,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ),
                )}
            </ol>
        </div>
    );
}
