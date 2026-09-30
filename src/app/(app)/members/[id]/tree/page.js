import { notFound } from 'next/navigation';
import FamilyTreeLoader from '@/components/members/family-tree-loader';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { canSeeFamily, getLineageTree, getPerson } from '@/lib/family';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.familyTree') };
}

/**
 * The family line as a tree: from the oldest recorded ancestor (father's line) down to the
 * youngest descendant, with this person highlighted. Only their family (anyone connected in
 * the tree), whoever added them and member managers can open it.
 */
export default async function FamilyTreePage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const person = await getPerson(Number(id) || 0);
    if (!person) notFound();
    if (!(await canSeeFamily(user, person))) notFound();
    const [tree, { t, locale }] = await Promise.all([getLineageTree(person.id), getT()]);
    const name = localized(person, 'full_name', locale);
    const alone = tree.top.id === person.id && tree.top.spouses.length === 0 && tree.top.children.length === 0;

    return (
        <div>
            <PageHeader title={t('members.familyTree')} subtitle={name} back={{ href: `/members/${person.id}`, label: name }} />
            {alone ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">{t('relations.empty')}</p>
            ) : (
                <FamilyTreeLoader tree={tree} />
            )}
        </div>
    );
}
