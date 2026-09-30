import { notFound } from 'next/navigation';
import MatrimonyForm from '@/components/matrimony/matrimony-form';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { getPerson, getRelatives } from '@/lib/family';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canListFor, getProfile, isEligible } from '@/lib/matrimony';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('matrimony.title') };
}

/** List / edit someone's matrimony profile — themselves, their family, member managers; unmarried 18+ only. */
export default async function MatrimonyEditPage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const p = await getProfile(Number(id) || 0);
    if (!p || !(await canListFor(user, p.id))) notFound();
    const { t, locale } = await getT();
    const name = localized(p, 'full_name', locale);
    const header = <PageHeader title={p.is_active ? t('matrimony.editTitle') : t('matrimony.listTitle')} subtitle={name} back={{ href: `/matrimony/${p.id}`, label: name }} />;
    if (!(await isEligible(p.id))) {
        return (
            <div className="theme-fundraise">
                {header}
                <p className="rounded-lg border border-surface-border bg-white px-4 py-8 text-center text-sm text-ink-gray">{t('matrimony.errors.notEligible')}</p>
            </div>
        );
    }
    // Suggested contact for a new listing: the father if he has a number, else the person.
    const [relatives, self, castes] = await Promise.all([getRelatives(p.id), getPerson(p.id), casteOptions(locale)]);
    const father = relatives.father?.phone ? relatives.father : null;
    const contact = father ? { name: father.full_name, phone: father.phone } : { name: self.full_name, phone: self.phone ?? '' };

    return (
        <div className="theme-fundraise">
            {header}
            <MatrimonyForm profile={p} contact={contact} castes={castes.castes} />
        </div>
    );
}
