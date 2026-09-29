import { notFound } from 'next/navigation';
import FamilyTreeLoader from '@/components/members/family-tree-loader';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getFamilyTree } from '@/lib/members';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.familyTree') };
}

export default async function FamilyTreePage({ params }) {
    const { id } = await params;
    await requireUser();
    const tree = await getFamilyTree(Number(id) || 0);
    if (!tree) notFound();
    const { t, locale } = await getT();
    const root = tree.generations[tree.rootIndex][0];
    const name = localized(root, 'full_name', locale);

    return (
        <div>
            <PageHeader
                title={t('members.familyTree')}
                subtitle={name}
                back={{ href: `/members/${root.id}`, label: name }}
            />
            {tree.generations.length === 1 && root.spouses.length === 0 ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">
                    {t('relations.empty')}
                </p>
            ) : (
                <FamilyTreeLoader tree={{ ...tree, edges: undefined }} />
            )}
        </div>
    );
}
