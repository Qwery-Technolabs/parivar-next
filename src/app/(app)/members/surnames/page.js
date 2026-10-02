import SurnameManager from '@/components/members/surname-manager';
import PageHeader from '@/components/shell/page-header';
import { requireRole } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';
import { listSurnames } from '@/lib/surnames';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('surnames.title') };
}

/** Members ⋮ → Surnames: every surname in use, each mapped to a caste → sub-caste (administrators). */
export default async function SurnamesPage() {
    await requireRole('administrator');
    const { t, locale } = await getT();
    const [surnames, options] = await Promise.all([listSurnames(), casteOptions(locale)]);
    return (
        <div>
            <PageHeader title={t('surnames.title')} subtitle={t('surnames.subtitle')} back={{ href: '/members', label: t('members.title') }} />
            <SurnameManager surnames={surnames} options={options} />
        </div>
    );
}
