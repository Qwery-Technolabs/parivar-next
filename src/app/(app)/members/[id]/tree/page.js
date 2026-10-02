import { notFound } from 'next/navigation';
import FamilyTreeLoader from '@/components/members/family-tree-loader';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { canSeeFamily, getLineageTree, getPerson, relationStepsFrom } from '@/lib/family';
import { kinTerm } from '@/lib/kinship';
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
    // Anyone signed in may view a family tree. Phone, birth date (age) and marital status stay for those
    // who may see this family (themselves, member managers, whoever added them, relatives).
    const family = await canSeeFamily(user, person);
    const [tree, steps, { t, locale }] = await Promise.all([getLineageTree(person.id), relationStepsFrom(person.id), getT()]);
    // Each card says how that person is related to the tree's person (Father, Kaka, Bhabhi …).
    const label = (p) => {
        p.kin = p.id === person.id ? null : kinTerm(steps.get(p.id));
        if (!family) {
            p.dob = null;
            p.phone = null;
            p.marital_status = null; // "married" still shows from a recorded spouse
        }
        p.spouses?.forEach(label);
        p.children?.forEach(label);
    };
    label(tree.top);
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
