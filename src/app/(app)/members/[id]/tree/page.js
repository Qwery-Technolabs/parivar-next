import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import FamilyTreeLoader from '@/components/members/family-tree-loader';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { canSeeFamily, familyTreeMeta, getPerson, treeFoldSettings } from '@/lib/family';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.familyTree') };
}

/**
 * The family line as a tree: from the oldest recorded ancestor (father's line) down to the
 * youngest descendant, with this person highlighted. Anyone signed in may view it; birth date (age)
 * and marital status stay for those who may see this family (themselves, member managers, whoever
 * added them, relatives).
 * The page itself only checks access and the family's version; the tree comes from api/family-tree
 * (?v=<version>), which the browser keeps — opening it again is instant and costs the server nothing.
 */
export default async function FamilyTreePage({ params }) {
    const { id } = await params;
    const pid = Number(id) || 0;
    const [user, person, meta, fold, { t, locale }] = await Promise.all([requireUser(), getPerson(pid), familyTreeMeta(pid), treeFoldSettings(), getT()]);
    if (!person) notFound();
    const family = await canSeeFamily(user, person);
    // What the viewer may see is part of the version, so a different viewer never gets someone else's copy; so are
    // the fold settings (Settings → Family tree).
    const src = `/api/family-tree/${person.id}?v=${meta.version}${family ? 'f' : 'p'}.${fold.key}`;
    // Start downloading the tree with the page, before its script runs.
    if (!meta.alone) preload(src, { as: 'fetch', crossOrigin: 'anonymous' });
    const name = localized(person, 'full_name', locale);

    return (
        <div>
            <PageHeader title={t('members.familyTree')} subtitle={name} back={{ href: `/members/${person.id}`, label: name }} />
            {meta.alone ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">{t('relations.empty')}</p>
            ) : (
                <FamilyTreeLoader src={src} />
            )}
        </div>
    );
}
