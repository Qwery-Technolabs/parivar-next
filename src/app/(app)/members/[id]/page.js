import { GitFork, Pencil, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FamilyCard from '@/components/members/family-card';
import PageHeader, { Card, LinkButton } from '@/components/shell/page-header';
import Badge, { BloodBadge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { age, date } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getFamily, getMember, memberGroups } from '@/lib/members';
import { formatPhone } from '@/lib/phone';
import { canEditUser } from '@/lib/roles';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const m = await getMember(Number(id) || 0);
    const { locale } = await getT();
    return { title: m ? localized(m, 'full_name', locale) : undefined };
}

function Detail({ label, children }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-ink-gray">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{children || <span className="text-ink-gray">—</span>}</dd>
        </div>
    );
}

export default async function MemberPage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const member = await getMember(Number(id) || 0);
    if (!member) notFound();
    const { t, locale } = await getT();
    const [family, groups] = await Promise.all([getFamily(member.id), memberGroups(member.id)]);
    const canEdit = canEditUser(user, member);
    const name = localized(member, 'full_name', locale);
    const otherName = locale === 'gu' ? member.full_name : member.full_name_gu;
    const m = member.meta;

    return (
        <div>
            <PageHeader
                title={name}
                subtitle={otherName && otherName !== name ? otherName : undefined}
                back={{ href: '/members', label: t('members.title') }}
                actions={
                    <>
                        <LinkButton href={`/members/${member.id}/tree`} icon={GitFork} variant="outline">
                            {t('members.familyTree')}
                        </LinkButton>
                        {canEdit && (
                            <LinkButton href={`/members/${member.id}/edit`} icon={Pencil}>
                                {t('common.edit')}
                            </LinkButton>
                        )}
                    </>
                }
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone={member.role === 'sabhyo' ? 'gray' : 'navy'}>{t(`roles.${member.role}`)}</Badge>
                {member.status !== 'active' && <Badge status={member.status}>{t(`status.${member.status}`)}</Badge>}
                <BloodBadge group={member.blood_group} />
                {member.is_blood_donor ? <Badge tone="blood">{t('members.donor')}</Badge> : null}
                <a
                    href={`tel:${member.phone}`}
                    className="ml-auto inline-flex h-9 items-center gap-2 rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                >
                    <Phone className="size-4 text-ink-gray" />
                    <span className="tabular-nums">{formatPhone(member.phone)}</span>
                </a>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card title={t('members.details')}>
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <Detail label={t('members.gender')}>{member.gender && t(`gender.${member.gender}`)}</Detail>
                        <Detail label={t('members.dob')}>
                            {member.dob && `${date(member.dob, locale)} · ${age(member.dob)}`}
                        </Detail>
                        <Detail label={t('members.village')}>{member.village}</Detail>
                        <Detail label={t('members.nativePlace')}>{m.native_place}</Detail>
                        <Detail label={t('members.caste')}>
                            {member.caste_name &&
                                [
                                    (locale === 'gu' && member.caste_name_gu) || member.caste_name,
                                    member.subcaste_name && ((locale === 'gu' && member.subcaste_name_gu) || member.subcaste_name),
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
                                <span className="whitespace-pre-line">{m.address}</span>
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
                    <FamilyCard
                        personId={member.id}
                        personName={name}
                        family={family}
                        canEdit={canEdit}
                    />
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
                                            <Badge tone="gray">{t('groups.member')}</Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
