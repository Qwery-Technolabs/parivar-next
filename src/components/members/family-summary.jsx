import { Users } from 'lucide-react';
import Link from 'next/link';
import { Card, LinkButton } from '@/components/shell/page-header';
import { RELATIVE_KINDS } from '@/lib/family';
import { localized } from '@/lib/i18n/config';

/**
 * The Family card on a member's profile (server component): their relatives by slot, each a
 * link, and "Family" → the Family page where relatives are added. People outside the family
 * see only a note — the family is private to it.
 */
export default function FamilySummary({ person, relatives, canSee, t, locale }) {
    const label = (kind) => (kind === 'spouse' ? (person.gender === 'female' ? 'husband' : person.gender === 'male' ? 'wife' : 'spouse') : kind);
    const rows = canSee
        ? RELATIVE_KINDS.flatMap((kind) => {
              const list = kind === 'father' || kind === 'mother' ? [relatives[kind]].filter(Boolean) : relatives[kind];
              return list.map((p) => ({ kind, p }));
          })
        : [];
    return (
        <Card
            title={t('members.family')}
            bodyClass=""
            actions={
                canSee && (
                    <LinkButton href={`/members/${person.id}/family`} icon={Users} variant="secondary" className="h-8 gap-1.5 px-2.5 text-xs">
                        {t('family.manage')}
                    </LinkButton>
                )
            }
        >
            {!canSee ? (
                <p className="px-4 py-5 text-sm text-ink-gray">{t('family.privateNote')}</p>
            ) : rows.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink-gray">{t('relations.empty')}</p>
            ) : (
                <ul className="divide-y divide-surface-border">
                    {rows.map(({ kind, p }) => (
                        <li key={`${kind}-${p.id}`} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-ink-gray">{t(`family.one.${label(kind)}`)}</span>
                            <Link href={`/members/${p.id}`} className="min-w-0 flex-1 break-words font-medium text-primary hover:underline">
                                {localized(p, 'full_name', locale)}
                            </Link>
                            {p.status === 'deceased' && <span className="text-xs text-ink-gray">{t('family.late')}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
