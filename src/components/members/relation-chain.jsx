import Link from 'next/link';
import { Card } from '@/components/shell/page-header';
import { localized } from '@/lib/i18n/config';
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

function Face({ p, name }) {
    const tone = p.status === 'deceased' ? 'from-gray-300 to-gray-500' : p.gender === 'female' ? 'from-rose-400 to-rose-600' : 'from-[#30466a] to-brand-navy';
    return (
        <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white shadow ${tone}`}>
            {initialOf(name)}
        </span>
    );
}

/** The little wavy link between two people, with the step written beside it ("'s father"). */
function Link2({ label }) {
    return (
        <div className="flex items-center gap-1.5 py-0.5 pl-5">
            <svg aria-hidden width="18" height="26" viewBox="0 0 18 26" className="shrink-0 text-slate-400">
                <circle cx="4" cy="3" r="2.5" fill="currentColor" />
                <path d="M4 5 C 4 14, 14 10, 14 19 L 14 26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-ink-gray">{label}</span>
        </div>
    );
}

/**
 * "How you're related" on a profile (server component): the chain of people from the viewer
 * to this person — You → 's father Devjibhai → 's sister Divyaben → 's husband Vishalbhai — and,
 * when there is a common word for it, what they are to you (Fuva / ફુવા).
 * `path` is relationPath(viewer, person).
 */
export default function RelationChain({ path, t, locale }) {
    const term = kinTerm(path.steps);
    const target = path.chain.at(-1).person;
    const targetName = localized(target, 'full_name', locale);
    return (
        <Card title={t('kin.title')} bodyClass="p-3">
            {term && (
                <p className="mb-3 rounded-md bg-accent px-3 py-2 text-sm text-primary">
                    {t('kin.summary', { name: targetName, term: t(`kin.terms.${term}`) })}
                </p>
            )}
            <ol>
                {path.chain.map(({ person, step }, i) => {
                    const name = localized(person, 'full_name', locale);
                    const first = i === 0;
                    return (
                        <li key={person.id}>
                            {step && <Link2 label={t(`kin.step.${step}`)} />}
                            <Link
                                href={`/members/${person.id}`}
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 shadow-sm hover:bg-accent/60 ${
                                    first || i === path.chain.length - 1 ? 'border-surface-border bg-white' : 'ml-5 border-surface-border/70 bg-white/80'
                                }`}
                            >
                                <Face p={person} name={name} />
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-primary">
                                        {name}
                                        {first && <span className="ml-1.5 text-xs font-medium text-brand-orange-strong">({t('kin.you')})</span>}
                                    </span>
                                    <span className="block truncate text-xs text-ink-gray">
                                        {[person.gender && t(`gender.${person.gender}`), person.status === 'deceased' && t('family.late'), person.village]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </Card>
    );
}
