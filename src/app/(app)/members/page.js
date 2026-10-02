import { cookies } from 'next/headers';
import Link from 'next/link';
import { Network, Phone, Smartphone, UserPlus, Tags } from 'lucide-react';
import { BulkBar, BulkSelectProvider, RowCheck, SelectAll } from '@/components/members/bulk-select';
import InviteMembersDialog from '@/components/members/invite-members-dialog';
import MemberRowActions from '@/components/members/member-row-actions';
import MembersToolbar from '@/components/members/members-toolbar';
import PageHeader from '@/components/shell/page-header';
import PageMenu from '@/components/shell/page-menu';
import Badge, { BloodBadge } from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { adminGroupIds } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { age } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { activeFilterCount, listCities, listGroupsBrief, listMembers, listVillages, resolveMemberFilters } from '@/lib/members';
import { formatPhone } from '@/lib/phone';
import { canEditUser, canInviteMembers, canManageGroups, canResetPassword, canManageMembers, canManageSettings, ROLES, canDeleteMember } from '@/lib/roles';
import { familyIds } from '@/lib/family';
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
    const [{ total, rows }, villages, groups, ownGroups, castes, cities] = await Promise.all([
        listMembers(filters, page, perPage),
        listVillages(),
        listGroupsBrief(),
        groupManager ? null : adminGroupIds(user.id),
        casteOptions(locale),
        listCities(),
    ]);
    const manage = canManageMembers(user.role);
    // Phone numbers of relatives added from a family tree: their family and member managers only.
    const family = manage ? null : await familyIds(user.id);
    const phoneShown = (m) => Boolean(m.phone) && (m.added_via !== 'family' || manage || m.created_by === user.id || family.has(m.id));
    // Row selection serves bulk group actions and the bulk password reset (sub-admin and up).
    const canBulkReset = canInviteMembers(user.role);
    // Who has never signed in is admin information (invites still pending).
    const seesRegistration = canInviteMembers(user.role);
    // A group admin may appoint only inside the groups they run; assignToGroup re-checks per group.
    const groupOptions = groups
        .filter((g) => groupManager || ownGroups.includes(g.id))
        .map((g) => ({ value: String(g.id), label: localized(g, 'name', locale) }));
    const bulk = groupOptions.length > 0 || canBulkReset;

    return (
        <div>
            <PageHeader
                title={t('members.title')}
                subtitle={`${t('members.subtitle')} · ${t('members.count', { count: total })}`}
                // The page's actions as a kebab beside the title.
                menu={
                    <PageMenu
                        items={[
                            manage && { key: 'add', label: t('members.add'), icon: <UserPlus />, href: '/members/new' },
                            canInviteMembers(user.role) && { key: 'invite', label: t('members.invite.button'), icon: <Smartphone /> },
                            canManageSettings(user.role) && { key: 'castes', label: t('members.manageCastes'), icon: <Network />, href: '/members/castes' },
                            // Surnames: everyone may look; editing stays with administrators (on that page).
                            { key: 'surnames', label: t('members.manageSurnames'), icon: <Tags />, href: '/members/surnames' },
                        ]}
                    >
                        {canInviteMembers(user.role) && <InviteMembersDialog groups={groupOptions} menuKey="invite" />}
                    </PageMenu>
                }
            />

            <MembersToolbar
                filters={filters}
                activeCount={activeFilterCount(filters)}
                villages={villages}
                cities={cities}
                castes={castes}
                roles={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            />

            {/* Bulk selection: for people who can put others into a group, or reset passwords. */}
            <BulkSelectProvider pageIds={bulk ? rows.map((r) => r.id) : []}>
            <BulkBar groups={groupOptions} canReset={canBulkReset} />
            <TableShell className="mt-4">
                <THead>
                    {bulk && (
                        <Th className="w-10">
                            <SelectAll />
                        </Th>
                    )}
                    {/* Phones: a wider name column so full names show (the table scrolls sideways). */}
                    <Th className="min-w-44">{t('members.fullName')}</Th>
                    <Th>{t('members.phone')}</Th>
                    <Th>{t('members.role')}</Th>
                    <Th className="hidden md:table-cell">{t('members.cityVillage')}</Th>
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
                    {rows.length === 0 && <EmptyRow colSpan={bulk ? 9 : 8}>{t('common.noResults')}</EmptyRow>}
                    {rows.map((m) => {
                        const primary = localized(m, 'full_name', locale);
                        const secondary = locale === 'gu' ? m.full_name : m.full_name_local;
                        return (
                            <Tr key={m.id}>
                                {bulk && (
                                    <Td className="w-10">
                                        <RowCheck id={m.id} label={primary} />
                                    </Td>
                                )}
                                <Td className="min-w-44 max-w-64">
                                    <Link href={`/members/${m.id}`} className="font-medium text-primary hover:underline">
                                        {primary}
                                    </Link>
                                    {secondary && secondary !== primary && (
                                        <span className="block text-xs text-ink-gray">{secondary}</span>
                                    )}
                                    {/* Occupation: from sm up only — on phones the name alone. */}
                                    {m.position && <span className="hidden text-xs font-medium text-brand-navy sm:block">{m.position}</span>}
                                    {m.status !== 'active' && (
                                        <Badge status={m.status} className="mt-1">
                                            {t(`status.${m.status}`)}
                                        </Badge>
                                    )}
                                    {seesRegistration && !m.last_login_at && (
                                        <Badge tone="amber" className="mt-1 ml-1">
                                            {t('groups.invite.notJoined')}
                                        </Badge>
                                    )}
                                </Td>
                                <Td>
                                    {phoneShown(m) ? (
                                        <a
                                            href={`tel:${m.phone}`}
                                            className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums text-primary hover:underline"
                                        >
                                            <Phone className="size-3.5 text-ink-gray" />
                                            {formatPhone(m.phone)}
                                        </a>
                                    ) : null}
                                </Td>
                                <Td>
                                    <Badge tone={m.role === 'sabhyo' ? 'gray' : 'navy'}>{t(`roles.${m.role}`)}</Badge>
                                </Td>
                                <Td className="hidden md:table-cell">
                                    {m.city || m.village ? (
                                        <>
                                            {m.city}
                                            {m.village && m.village !== m.city && <span className="block text-xs text-ink-gray">{m.village}</span>}
                                        </>
                                    ) : null}
                                </Td>
                                <Td className="hidden lg:table-cell">
                                    {m.caste_name && (
                                        <>
                                            {localized({ n: m.caste_name, n_local: m.caste_name_local }, 'n', locale)}
                                            {m.subcaste_name && (
                                                <span className="block text-xs text-ink-gray">
                                                    {localized({ n: m.subcaste_name, n_local: m.subcaste_name_local }, 'n', locale)}
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
                                        canEdit={canEditUser(user, m) || canResetPassword(user, m)}
                                        groups={groupOptions}
                                        canAssignGroups={groupOptions.length > 0}
                                        canDelete={canDeleteMember(user, m)}
                                    />
                                </Td>
                            </Tr>
                        );
                    })}
                </tbody>
            </TableShell>
            </BulkSelectProvider>
            <Pagination pathname="/members" searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
        </div>
    );
}
