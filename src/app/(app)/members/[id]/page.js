import { Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FamilySummary from '@/components/members/family-summary';
import PageHeader, { Card } from '@/components/shell/page-header';
import PageMenu from '@/components/shell/page-menu';
import Badge, { BloodBadge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { age, date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getMember, memberDonations, memberGroups } from '@/lib/members';
import { birthName, isMarriedWoman } from '@/lib/names';
import AddressActions from '@/components/members/address-actions';
import { canSeeFamily, getRelatives, relationPath } from '@/lib/family';
import { formatPhone } from '@/lib/phone';
import { canEditUser, canInviteMembers, canManageAllFundraises, canResetPassword, canDeleteMember, atLeast } from '@/lib/roles';
import { deleteMember, setMemberArchived } from '@/app/actions/members';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const m = await getMember(Number(id) || 0);
    const { locale } = await getT();
    return { title: m ? localized(m, 'full_name', locale) : undefined };
}

/** Phones: label left, value right on one line (a divided list). From sm up: label above value, two columns. */
function Detail({ label, children }) {
    return (
        <div className="flex min-w-0 items-baseline justify-between gap-3 py-2 sm:block sm:py-0">
            <dt className="w-2/5 shrink-0 text-[11px] uppercase tracking-wide text-ink-gray sm:w-auto">{label}</dt>
            <dd className="min-w-0 break-words text-right text-sm text-ink sm:mt-0.5 sm:text-left">{children || <span className="text-ink-gray">—</span>}</dd>
        </div>
    );
}

export default async function MemberPage({ params }) {
    const [{ id }, user] = await Promise.all([params, requireUser()]);
    const memberId = Number(id) || 0;
    // One round of parallel queries (speed) — only the family check needs the loaded member.
    const [member, { t, locale }, relatives, groups, donations, relation] = await Promise.all([
        getMember(memberId),
        getT(),
        getRelatives(memberId),
        memberGroups(memberId),
        memberDonations(memberId, user.id === memberId || canManageAllFundraises(user.role)),
        // How this person is related to the viewer (any chain through the family tree).
        user.id === memberId ? null : relationPath(user.id, memberId),
    ]);
    if (!member) notFound();
    // An archived member is visible to administrators (and up) only.
    if (member.status === 'archived' && !atLeast(user.role, 'administrator')) notFound();
    const seeFamily = await canSeeFamily(user, member);
    const canEdit = canEditUser(user, member);
    // The Edit page also opens for a password-only reset (it then shows just that tab).
    const canOpenEdit = canEdit || canResetPassword(user, member);
    const name = localized(member, 'full_name', locale);
    const otherName = locale === 'gu' ? member.full_name : member.full_name_local;
    const m = member.meta;
    // A relative added from a family tree: phone, birth date and marital status are for the family only.
    const privateDetails = m.added_via === 'family' && !seeFamily;

    return (
        <div>
            <PageHeader
                title={name}
                subtitle={
                    [
                        otherName && otherName !== name ? otherName : null,
                        // A married woman: her maiden name (father's name + surname) under the married one.
                        isMarriedWoman(member) && birthName(member, locale !== 'en') && birthName(member, locale !== 'en') !== name
                            ? `${t('members.maidenName')}: ${birthName(member, locale !== 'en')}`
                            : null,
                        canInviteMembers(user.role) && !member.last_login_at ? t('groups.invite.notJoined') : null,
                    ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                }
                back={{ href: '/members', label: t('members.title') }}
                menu={
                    <PageMenu
                        items={[
                            canOpenEdit && { key: 'edit', label: t('common.edit'), icon: 'pencil', href: `/members/${member.id}/edit` },
                            { key: 'tree', label: t('members.familyTree'), icon: 'git-fork', href: `/members/${member.id}/tree` },
                            // Archive first (super admins / administrators); only an archived member can be
                            // restored or deleted for good (last, red, asks first).
                            canDeleteMember(user, member) &&
                                member.status !== 'archived' && {
                                    key: 'archive',
                                    label: t('members.archive'),
                                    icon: 'archive',
                                    action: setMemberArchived.bind(null, member.id, true),
                                    confirm: t('members.archiveConfirm', { name }),
                                    group: 'danger',
                                },
                            canDeleteMember(user, member) &&
                                member.status === 'archived' && {
                                    key: 'restore',
                                    label: t('members.restore'),
                                    icon: 'archive-restore',
                                    action: setMemberArchived.bind(null, member.id, false),
                                    group: 'danger',
                                },
                            canDeleteMember(user, member) &&
                                member.status === 'archived' && {
                                    key: 'delete',
                                    group: 'danger',
                                    label: t('members.delete'),
                                    icon: 'trash',
                                    action: deleteMember.bind(null, member.id, true),
                                    confirm: t('members.deleteConfirm', { name }),
                                    danger: true,
                                },
                        ]}
                    />
                }
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone={member.role === 'sabhyo' ? 'gray' : 'navy'}>{t(`roles.${member.role}`)}</Badge>
                {member.status !== 'active' && <Badge status={member.status}>{t(`status.${member.status}`)}</Badge>}
                <BloodBadge group={member.blood_group} />
                {member.is_blood_donor ? <Badge tone="blood">{t('members.donor')}</Badge> : null}
                {member.phone && !privateDetails && (
                    <a href={`tel:${member.phone}`} className="ml-auto inline-flex h-9 items-center gap-2 rounded-md btn-secondary px-3 text-sm font-medium">
                        <Phone className="size-4" />
                        <span className="tabular-nums">{formatPhone(member.phone)}</span>
                    </a>
                )}
            </div>

            {/* No login yet (e.g. added from a family tree without a number): tell those who can fix it. */}
            {!member.can_login && member.status !== 'deceased' && canEdit && (
                <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {t('members.noLogin')}{' '}
                    <Link href={`/members/${member.id}/edit`} className="font-medium underline">
                        {t('common.edit')}
                    </Link>
                </p>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
                <Card title={t('members.details')}>
                    <dl className="grid divide-y divide-surface-border sm:grid-cols-2 sm:gap-4 sm:divide-y-0">
                        <Detail label={t('members.gender')}>{member.gender && t(`gender.${member.gender}`)}</Detail>
                        <Detail label={t('members.dob')}>{!privateDetails && member.dob && `${date(member.dob, locale)} · ${age(member.dob)}`}</Detail>
                        <Detail label={t('family.maritalStatus')}>
                            {!privateDetails && member.marital_status && t(`family.marital.${member.marital_status}`)}
                        </Detail>
                        <Detail label={t('members.village')}>{member.village}</Detail>
                        <Detail label={t('members.position')}>{m.position}</Detail>
                        <Detail label={t('members.city')}>{member.city}</Detail>
                        <Detail label={t('members.caste')}>
                            {member.caste_name &&
                                [
                                    (locale === 'gu' && member.caste_name_local) || member.caste_name,
                                    member.subcaste_name && ((locale === 'gu' && member.subcaste_name_local) || member.subcaste_name),
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                        </Detail>
                        <Detail label={t('members.occupation')}>{m.occupation}</Detail>
                        <Detail label={t('members.education')}>{m.education}</Detail>
                        <Detail label={t('members.altPhone')}>{m.alt_phone}</Detail>
                        <Detail label={t('members.email')}>{m.email}</Detail>
                        <div className="sm:col-span-2">
                            <Detail label={t('members.address')}>
                                {/* Copy / Map / Directions (Google Maps; the city is added to the search when the address lacks it). */}
                                {m.address && (
                                    <AddressActions
                                        address={m.address}
                                        query={
                                            member.city && !m.address.toLowerCase().includes(String(member.city).toLowerCase())
                                                ? `${m.address}, ${member.city}`
                                                : m.address
                                        }
                                    />
                                )}
                            </Detail>
                        </div>
                        {m.bio && (
                            <div className="sm:col-span-2">
                                <Detail label={t('members.bio')}>
                                    <span className="whitespace-pre-line">{m.bio}</span>
                                </Detail>
                            </div>
                        )}
                    </dl>
                </Card>

                <div className="space-y-4">
                    <FamilySummary person={member} relatives={relatives} canSee={seeFamily} canEdit={seeFamily} relation={relation} t={t} locale={locale} />
                    <Card title={t('members.groups')} bodyClass="">
                        {groups.length === 0 ? (
                            <p className="px-4 py-5 text-sm text-ink-gray">{t('common.none')}</p>
                        ) : (
                            <ul className="divide-y divide-surface-border">
                                {groups.map((g) => (
                                    <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                        <Link href={`/groups/${g.id}`} className="min-w-0 font-medium text-primary hover:underline">
                                            {localized(g, 'name', locale)}
                                        </Link>
                                        {g.member_role === 'admin' ? (
                                            <Badge tone="orange">
                                                <ShieldCheck className="size-3" /> {t('groups.admin')}
                                            </Badge>
                                        ) : (
                                            <Badge tone={g.member_role === 'sub_admin' ? 'blue' : g.member_role === 'speaker' ? 'green' : 'gray'}>
                                                {t(`groups.roles.${g.member_role}`)}
                                            </Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    {donations.gifts > 0 && (
                        <Card title={t('members.donations')} bodyClass="" className="theme-fundraise">
                            <div className="flex items-end justify-between gap-3 border-b border-surface-border px-4 py-3">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('members.totalDonated')}</p>
                                    <p className="text-2xl font-semibold tabular-nums text-income">{money(donations.total)}</p>
                                </div>
                                <p className="text-xs text-ink-gray">{t('members.donationCount', { count: donations.gifts })}</p>
                            </div>
                            <ul className="divide-y divide-surface-border">
                                {donations.groups.map((g) => (
                                    <li key={g.id ?? 0} className="px-4 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            {g.id ? (
                                                <Link
                                                    href={`/groups/${g.id}`}
                                                    className="min-w-0 break-words text-sm font-semibold text-primary hover:underline"
                                                >
                                                    {localized(g, 'name', locale)}
                                                </Link>
                                            ) : (
                                                <span className="text-sm font-semibold text-ink-gray">{t('fundraise.noGroup')}</span>
                                            )}
                                            <span className="shrink-0 text-sm font-semibold tabular-nums text-income">{money(g.total)}</span>
                                        </div>
                                        <ul className="mt-1.5 space-y-1">
                                            {g.campaigns.map((c) => (
                                                <li key={c.campaign_id} className="flex items-center justify-between gap-2 text-xs">
                                                    <Link href={`/fundraise/${c.campaign_id}`} className="min-w-0 break-words text-primary hover:underline">
                                                        {localized(c, 'title', locale)}
                                                    </Link>
                                                    <span className="shrink-0 tabular-nums text-ink-gray">
                                                        {money(c.total)} · {date(c.last_paid, locale)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
