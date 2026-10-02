import { GitFork, Link2Off } from 'lucide-react';
import Link from 'next/link';
import { removeRelative } from '@/app/actions/family';
import ActionButton from '@/components/fundraise/action-button';
import AddRelativeDialog from '@/components/members/add-relative-dialog';
import { LinkButton } from '@/components/shell/page-header';
import FamilyCardShell from '@/components/members/family-card-shell';
import RelationChain from '@/components/members/relation-chain';
import Badge from '@/components/ui/badge';
import { RELATIVE_KINDS } from '@/lib/family';
import { age } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { birthName } from '@/lib/names';

/**
 * The Family card on a member's profile (server component). Header: "Family tree" (the whole tree
 * canvas) and "+ Add" (popup: pick the relation, then add — stays open for more). Body: the near
 * relatives by slot — Father, Mother, Wife / Husband, Brothers, Sisters, Sons, Daughters — each
 * name opening that person's profile (to add to their family in turn). People outside the family
 * see only a note: the family is private to it.
 */
export default function FamilySummary({ person, relatives, canSee, canEdit, relation = null, t, locale }) {
    const spouseKey = person.gender === 'female' ? 'husband' : person.gender === 'male' ? 'wife' : 'spouse';
    const groups = canSee
        ? RELATIVE_KINDS.map((kind) => ({
              kind,
              title: t(`family.kinds.${kind === 'spouse' ? spouseKey : kind}`),
              list: kind === 'father' || kind === 'mother' ? [relatives[kind]].filter(Boolean) : relatives[kind],
          })).filter((g) => g.list.length)
        : [];
    const detail = (p) => [p.dob && age(p.dob) != null && `${age(p.dob)}`, p.marital_status && t(`family.marital.${p.marital_status}`)].filter(Boolean).join(' · ');

    // Only what the chain shows goes to the browser (no phone numbers).
    const relationView = relation && (
        <RelationChain
            path={{
                steps: relation.steps,
                chain: relation.chain.map(({ person: p, step }) => ({
                    step,
                    person: {
                        id: p.id,
                        full_name: p.full_name,
                        full_name_local: p.full_name_local,
                        first_name: p.first_name,
                        first_name_local: p.first_name_local,
                        maiden_middle_name: p.maiden_middle_name,
                        maiden_surname: p.maiden_surname,
                        maiden_middle_name_local: p.maiden_middle_name_local,
                        maiden_surname_local: p.maiden_surname_local,
                        gender: p.gender,
                        status: p.status,
                        village: p.village,
                    },
                })),
            }}
        />
    );

    return (
        <FamilyCardShell
            title={t('members.family')}
            relation={relationView}
            actions={
                // The tree is open to every member; adding relatives stays with those who may edit this family.
                (
                    <div className="flex items-center gap-1.5">
                        <LinkButton
                            href={`/members/${person.id}/tree`}
                            icon={GitFork}
                            variant="outline"
                            className="h-8 gap-1.5 px-2.5 text-xs max-sm:size-8 max-sm:px-0"
                        >
                            <span className="max-sm:sr-only">{t('members.familyTree')}</span>
                        </LinkButton>
                        {canEdit && (
                            <AddRelativeDialog
                                person={person}
                                spouse={relatives.spouse[0] ?? null}
                                filled={{ father: Boolean(relatives.father), mother: Boolean(relatives.mother) }}
                            />
                        )}
                    </div>
                )
            }
            family={
            !canSee ? (
                <p className="px-4 py-5 text-sm text-ink-gray">{t('family.privateNote')}</p>
            ) : groups.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink-gray">{t('relations.empty')}</p>
            ) : (
                <ul className="divide-y divide-surface-border">
                    {groups.map((g) =>
                        g.list.map((p, i) => {
                            // In her father's family a married daughter / sister goes by her maiden name.
                            const name =
                                ((g.kind === 'daughter' || g.kind === 'sister') && birthName(p, locale !== 'en')) || localized(p, 'full_name', locale);
                            return (
                                <li key={`${g.kind}-${p.id}`} className="flex items-center gap-3 px-4 py-2">
                                    {/* The slot name once per group; later rows of the same group leave it blank. */}
                                    <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-ink-gray">{i === 0 ? g.title : ''}</span>
                                    <div className="min-w-0 flex-1">
                                        <Link href={`/members/${p.id}`} className="break-words font-medium text-primary hover:underline">
                                            {name}
                                        </Link>
                                        {p.status === 'deceased' && (
                                            <Badge tone="gray" className="ml-2">
                                                {t('family.late')}
                                            </Badge>
                                        )}
                                        {detail(p) && <p className="text-xs text-ink-gray tabular-nums">{detail(p)}</p>}
                                    </div>
                                    {canEdit && (
                                        <ActionButton
                                            action={removeRelative.bind(null, person.id, p.id)}
                                            confirm={t('family.removeConfirm', { name })}
                                            icon={<Link2Off className="size-4" />}
                                            label={t('family.remove')}
                                            plain
                                            className="size-8 justify-center px-0 text-ink-gray hover:bg-destructive/10 hover:text-destructive"
                                        />
                                    )}
                                </li>
                            );
                        }),
                    )}
                </ul>
            )
            }
        />
    );
}
