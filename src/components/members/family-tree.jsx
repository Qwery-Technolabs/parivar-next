'use client';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
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
            href={`/members/${p.id}/tree`}
            aria-current={isRoot ? 'true' : undefined}
            className={`block w-36 shrink-0 rounded-md border border-t-2 border-surface-border bg-white px-2.5 py-2 text-left shadow-sm hover:bg-accent ${tone} ${
                isRoot ? 'ring-2 ring-brand-orange' : ''
            } ${p.status === 'deceased' ? 'opacity-75' : ''}`}
        >
            <span className="block break-words text-sm font-medium leading-snug text-primary">{name}</span>
            {showDetails && (
                <span className="mt-0.5 block text-xs text-ink-gray">
                    {[a != null && `${a}`, p.blood_group, p.status === 'deceased' && t('status.deceased')].filter(Boolean).join(' · ') ||
                        '—'}
                </span>
            )}
        </Link>
    );
}

/**
 * Generation rows, oldest at the top. Each unit is a person with their spouse(s) beside
 * them. The rows scroll sideways INSIDE this box — a wide family must never push the page.
 */
export default function FamilyTree({ tree }) {
    const { t } = useT();
    const [showDetails, setShowDetails] = useState(true);

    return (
        <div>
            <div className="mb-3 flex justify-end">
                <Switch checked={showDetails} onChange={setShowDetails} label={t('members.details')} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-surface-border bg-white p-4 shadow-sm">
                <div className="flex min-w-max flex-col items-center gap-0">
                    {tree.generations.map((row, gi) => (
                        <div key={gi} className="flex flex-col items-center">
                            {gi > 0 && <span aria-hidden className="h-6 w-px bg-surface-border" />}
                            <div
                                className={`flex flex-wrap justify-center gap-4 rounded-lg px-3 py-3 ${
                                    gi === tree.rootIndex ? 'bg-accent' : ''
                                }`}
                            >
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
