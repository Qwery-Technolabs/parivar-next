import { GitFork, Link2Off } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { removeRelative } from '@/app/actions/family';
import ActionButton from '@/components/fundraise/action-button';
import AddRelativeDialog from '@/components/members/add-relative-dialog';
import PageHeader, { Card, LinkButton } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { canEditFamily, canSeeFamily, getPerson, getRelatives, RELATIVE_KINDS } from '@/lib/family';
import { age } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { formatPhone } from '@/lib/phone';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('family.title') };
}

/** Plural slot title and singular "Add …" word; the spouse slot follows the person's gender. */
function slotLabels(kind, gender, t) {
    const k = kind === 'spouse' ? (gender === 'female' ? 'husband' : gender === 'male' ? 'wife' : 'spouse') : kind;
    return { title: t(`family.kinds.${k}`), one: t(`family.one.${k}`) };
}

/**
 * A person's Family page: Father, Mother, Wife / Husband, Brothers, Sisters, Sons, Daughters —
 * each with "+ Add". Every relative opens their own Family page, so the tree grows outward
 * (father → his father, his brothers …). Only the person's family (anyone connected in the
 * tree), whoever added them and member managers can open it.
 */
export default async function FamilyPage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const person = await getPerson(Number(id) || 0);
    if (!person) notFound();
    if (!(await canSeeFamily(user, person))) notFound();
    const { t, locale } = await getT();
    const [relatives, canEdit] = await Promise.all([getRelatives(person.id), canEditFamily(user, person)]);
    const name = localized(person, 'full_name', locale);

    const detail = (p) =>
        [
            p.dob && age(p.dob) != null && `${age(p.dob)}`,
            p.marital_status && t(`family.marital.${p.marital_status}`),
            p.phone && formatPhone(p.phone),
        ]
            .filter(Boolean)
            .join(' · ');

    return (
        <div>
            <PageHeader
                title={t('family.title')}
                subtitle={name}
                back={{ href: `/members/${person.id}`, label: name }}
                actions={
                    <LinkButton href={`/members/${person.id}/tree`} icon={GitFork} variant="outline" className="h-8 px-3 text-xs">
                        {t('members.familyTree')}
                    </LinkButton>
                }
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {RELATIVE_KINDS.map((kind) => {
                    const list = kind === 'father' || kind === 'mother' ? [relatives[kind]].filter(Boolean) : relatives[kind];
                    // One father and one mother; any number of the rest (a widow may remarry).
                    const canAdd = canEdit && !((kind === 'father' || kind === 'mother') && list.length);
                    const { title, one } = slotLabels(kind, person.gender, t);
                    return (
                        <Card key={kind} title={title} bodyClass="" actions={canAdd && <AddRelativeDialog person={person} kind={kind} label={one} />}>
                            {list.length === 0 ? (
                                <p className="px-3.5 py-4 text-sm text-ink-gray">{t('family.none')}</p>
                            ) : (
                                <ul className="divide-y divide-surface-border">
                                    {list.map((p) => {
                                        const pn = localized(p, 'full_name', locale);
                                        return (
                                            <li key={p.id} className="flex items-center gap-2 px-3.5 py-2.5">
                                                <div className="min-w-0 flex-1">
                                                    <Link href={`/members/${p.id}/family`} className="break-words font-medium text-primary hover:underline">
                                                        {pn}
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
                                                        confirm={t('family.removeConfirm', { name: pn })}
                                                        icon={<Link2Off className="size-4" />}
                                                        label={t('family.remove')}
                                                        plain
                                                        className="size-8 justify-center px-0 text-ink-gray hover:bg-destructive/10 hover:text-destructive"
                                                    />
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
