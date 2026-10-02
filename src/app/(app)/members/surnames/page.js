import SurnameManager from '@/components/members/surname-manager';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { canManageSettings } from '@/lib/roles';
import { casteOptions } from '@/lib/castes';
import { getT } from '@/lib/i18n/server';
import { listSurnames } from '@/lib/surnames';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('surnames.title') };
}

/**
 * Members ⋮ → Surnames: every surname in use with its caste → sub-caste and how many carry it.
 * Everyone may look (and open "Members" for a surname); only administrators add / edit / assign.
 */
export default async function SurnamesPage() {
    const user = await requireUser();
    const { t, locale } = await getT();
    const [surnames, options] = await Promise.all([listSurnames(), casteOptions(locale)]);
    return (
        <div>
            <PageHeader title={t('surnames.title')} subtitle={t('surnames.subtitle')} back={{ href: '/members', label: t('members.title') }} />
            <SurnameManager surnames={surnames} options={options} canEdit={canManageSettings(user.role)} />
        </div>
    );
}
