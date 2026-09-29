import { cookies } from 'next/headers';
import Link from 'next/link';
import { Phone, UserPlus } from 'lucide-react';
import MemberRowActions from '@/components/members/member-row-actions';
import MembersToolbar from '@/components/members/members-toolbar';
import PageHeader, { LinkButton } from '@/components/shell/page-header';
import Badge, { BloodBadge } from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { adminGroupIds } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { age } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { activeFilterCount, listGroupsBrief, listMembers, listVillages, resolveMemberFilters } from '@/lib/members';
import { formatPhone } from '@/lib/phone';
import { canEditUser, canManageGroups, canManageMembers, ROLES } from '@/lib/roles';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('members.title') };
}

export default async function MembersPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const filters = resolveMemberFilters(sp);
    const page = normalizePage(sp.page);
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);

    const groupManager = canManageGroups(user.role);
    const [{ total, rows }, villages, groups, ownGroups, castes] = await Promise.all([
        listMembers(filters, page, perPage),
        listVillages(),
        listGroupsBrief(),
        groupManager ? null : adminGroupIds(user.id),
        casteOptions(locale),
    ]);
    const manage = canManageMembers(user.role);
    // A group admin may appoint only inside the groups they run; assignToGroup re-checks per group.
    const groupOptions = groups
        .filter((g) => groupManager || ownGroups.includes(g.id))
        .map((g) => ({ value: String(g.id), label: localized(g, 'name', locale) }));

    return (
        <div>
            <PageHeader
                title={t('members.title')}
                subtitle={`${t('members.subtitle')} · ${t('members.count', { count: total })}`}
                actions={
                    manage && (
                        <LinkButton href="/members/new" icon={UserPlus} className="w-full sm:w-auto">
                            {t('members.add')}
                        </LinkButton>
                    )
                }
            />

            <MembersToolbar
                filters={filters}
                activeCount={activeFilterCount(filters)}
                villages={villages}
                castes={castes}
                roles={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            />

            <TableShell className="mt-4">
                <THead>
                    <Th>{t('members.fullName')}</Th>
                    <Th>{t('members.phone')}</Th>
                    <Th>{t('members.role')}</Th>
                    <Th className="hidden md:table-cell">{t('members.village')}</Th>
                    <Th className="hidden lg:table-cell">{t('members.caste')}</Th>
                    <Th>{t('members.bloodGroup')}</Th>
                    <Th numeric className="hidden sm:table-cell">
                        {t('members.age')}
                    </Th>
                    <Th className="w-12">
                        <span className="sr-only">{t('common.actions')}</span>
                    </Th>
                </THead>
                <tbody>
                    {rows.length === 0 && <EmptyRow colSpan={8}>{t('common.noResults')}</EmptyRow>}
                    {rows.map((m) => {
                        const primary = localized(m, 'full_name', locale);
                        const secondary = locale === 'gu' ? m.full_name : m.full_name_gu;
                        return (
                            <Tr key={m.id}>
                                <Td className="max-w-64">
                                    <Link href={`/members/${m.id}`} className="font-medium text-primary hover:underline">
                                        {primary}
                                    </Link>
                                    {secondary && secondary !== primary && (
                                        <span className="block text-xs text-ink-gray">{secondary}</span>
                                    )}
                                    {m.status !== 'active' && (
                                        <Badge status={m.status} className="mt-1">
                                            {t(`status.${m.status}`)}
                                        </Badge>
                                    )}
                                </Td>
                                <Td>
                                    <a
                                        href={`tel:${m.phone}`}
                                        className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums text-primary hover:underline"
                                    >
                                        <Phone className="size-3.5 text-ink-gray" />
                                        {formatPhone(m.phone)}
                                    </a>
                                </Td>
                                <Td>
                                    <Badge tone={m.role === 'sabhyo' ? 'gray' : 'navy'}>{t(`roles.${m.role}`)}</Badge>
                                </Td>
                                <Td className="hidden md:table-cell">{m.village}</Td>
                                <Td className="hidden lg:table-cell">
                                    {m.caste_name && (
                                        <>
                                            {localized({ n: m.caste_name, n_gu: m.caste_name_gu }, 'n', locale)}
                                            {m.subcaste_name && (
                                                <span className="block text-xs text-ink-gray">
                                                    {localized({ n: m.subcaste_name, n_gu: m.subcaste_name_gu }, 'n', locale)}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </Td>
                                <Td>
                                    <span className="inline-flex items-center gap-1">
                                        <BloodBadge group={m.blood_group} />
                                        {m.is_blood_donor ? (
                                            <span title={t('members.donor')} className="size-1.5 rounded-full bg-rose-700" />
                                        ) : null}
                                    </span>
                                </Td>
                                <Td numeric className="hidden sm:table-cell">
                                    {age(m.dob)}
                                </Td>
                                <Td className="text-right">
                                    <MemberRowActions
                                        member={{ id: m.id, name: primary }}
                                        canEdit={canEditUser(user, m)}
                                        groups={groupOptions}
                                        canAssignGroups={groupOptions.length > 0}
                                    />
                                </Td>
                            </Tr>
                        );
                    })}
                </tbody>
            </TableShell>
            <Pagination pathname="/members" searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
        </div>
    );
}
