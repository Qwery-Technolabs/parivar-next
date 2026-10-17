import { BellRing, GitFork, MessageCircle, Navigation, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FamilySummary from '@/components/members/family-summary';
import HeaderBack from '@/components/shell/header-back';
import { Card } from '@/components/shell/page-header';
import PageMenu from '@/components/shell/page-menu';
import PushDevicesDialog from '@/components/members/push-devices-dialog';
import Badge, { BloodBadge } from '@/components/ui/badge';
import { LinkIconSpinner } from '@/components/ui/link-spinner';
import { requireUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { age, date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { kinTerm } from '@/lib/kinship';
import { canAddRelativePhone } from '@/lib/relative-phone';
import { canSeeContact } from '@/lib/contact-privacy';
import { getMember, memberDonations, memberGroups } from '@/lib/members';
import { birthName, isMarriedWoman } from '@/lib/names';
import AddressActions from '@/components/members/address-actions';
import { canSeeFamily, getRelatives, relationPath } from '@/lib/family';
import { countryName, formatPhone, waNumber } from '@/lib/phone';
import { canEditUser, canInviteMembers, canManageAllFundraises, canResetPassword, canDeleteMember, atLeast, canManageSettings } from '@/lib/roles';
import { deleteMember, setMemberArchived } from '@/app/actions/members';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const m = await getMember(Number(id) || 0);
    const { locale } = await getT();
    return { title: m ? localized(m, 'full_name', locale) : undefined };
}

/** Phones: label left, value right on one line (a divided list). From sm up: label above value, two columns. */
function Detail({ label, children, wide = false }) {
    return (
        <div className={`flex min-w-0 items-baseline justify-between gap-3 py-2 sm:block sm:py-0${wide ? ' sm:col-span-2' : ''}`}>
            <dt className="w-2/5 shrink-0 text-[11px] uppercase tracking-wide text-ink-gray sm:w-auto">{label}</dt>
            <dd className="min-w-0 break-words text-right text-sm text-ink sm:mt-0.5 sm:text-left">{children}</dd>
        </div>
    );
}

/**
 * A profile card of details: only the filled rows (a public profile shows no "—" lines). Nothing filled → the card is
 * left out, except for whoever may edit, who gets a one-line "Nothing added yet · Edit".
 */
function DetailsCard({ title, rows, editHref, t }) {
    const filled = rows.filter((r) => r && r.value);
    if (filled.length === 0 && !editHref) return null;
    return (
        <Card title={title}>
            {filled.length === 0 ? (
                <p className="text-sm text-ink-gray">
                    {t('members.profile.empty')}{' '}
                    <Link href={editHref} className="font-medium text-primary underline">
                        {t('common.edit')}
                    </Link>
                </p>
            ) : (
                <dl className="grid divide-y divide-surface-border sm:grid-cols-2 sm:gap-4 sm:divide-y-0">
                    {filled.map((r) => (
                        <Detail key={r.key} label={r.label} wide={r.wide}>
                            {r.value}
                        </Detail>
                    ))}
                </dl>
            )}
        </Card>
    );
}

/** First visible letter (whole grapheme, so Gujarati vowel signs stay attached). */
function initialOf(name) {
    const text = String(name ?? '').trim();
    if (!text) return '?';
    try {
        return new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next().value.segment.toUpperCase();
    } catch {
        return Array.from(text)[0].toUpperCase();
    }
}

/** Hero actions on navy: glass buttons; Call is the light green one (with the number) — every call button is green. */
const glassBtn =
    'inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-white/20 bg-white/10 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20 sm:h-9';
const callBtn =
    'inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-100 px-4 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-200 sm:h-9 sm:flex-none';

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
    // Who added this profile (users_list.created_by), for the small line under the Details card.
    // "Added by …" (last line of the page): app admins / sub-admins see who added anyone (or "Joined"); whoever added
    // this profile themselves (e.g. a relative from their family tree) sees "Added by you"; nobody else sees it.
    const addedByMe = Boolean(member.created_by) && member.created_by === user.id && member.id !== user.id;
    const seesAddedBy = atLeast(user.role, 'sub_admin');
    // Notification devices (push tokens): administrators and the member themself.
    const seesPush = user.id === memberId || canManageSettings(user.role);
    const [seeFamily, addedBy, canAddPhone, contactOk, pushCount] = await Promise.all([
        canSeeFamily(user, member),
        seesAddedBy && !addedByMe && member.created_by && member.created_by !== member.id
            ? queryOne('SELECT id, full_name, full_name_local FROM users_list WHERE id = :id', { id: member.created_by })
            : null,
        // A new relative's phone (= a login): Settings → General decides who (the relation is already known here).
        canAddRelativePhone(user, { familyOf: member, steps: user.id === member.id ? 0 : relation ? relation.steps.length : null }),
        // A woman's numbers: Settings → Permissions → Women's contact numbers (lib/contact-privacy.js).
        canSeeContact(user, member, relation),
        seesPush ? queryOne('SELECT COUNT(*) AS n FROM users_push_subscriptions WHERE user_id = :id', { id: memberId }).then((r) => Number(r.n)) : 0,
    ]);
    const canEdit = canEditUser(user, member);
    // The Edit page also opens for a password-only reset (it then shows just that tab).
    const canOpenEdit = canEdit || canResetPassword(user, member);
    const name = localized(member, 'full_name', locale);
    const otherName = locale === 'gu' ? member.full_name : member.full_name_local;
    const m = member.meta;
    // A relative added from a family tree: phone numbers, email, birth date and marital status are for the family only.
    const privateDetails = m.added_via === 'family' && !seeFamily;
    const isMe = user.id === member.id;
    const late = member.status === 'deceased';
    const maiden = isMarriedWoman(member) ? birthName(member, locale !== 'en') : null;
    // How this person is to the viewer, in one word (Kaka, Bhabhi …) when there is one.
    const kin = relation ? kinTerm(relation.steps) : null;
    const phone = !privateDetails && !late && contactOk ? member.phone : null;
    const callable = Boolean(phone) && !isMe;
    // The home pin (set with the map picker on the edit page): a Directions button (Google Maps) to that exact spot.
    const pin = m.home_lat && m.home_lng ? `${m.home_lat},${m.home_lng}` : null;
    const editHref = canEdit ? `/members/${member.id}/edit` : null;
    const caste =
        member.caste_name &&
        [
            (locale === 'gu' && member.caste_name_local) || member.caste_name,
            member.subcaste_name && ((locale === 'gu' && member.subcaste_name_local) || member.subcaste_name),
        ]
            .filter(Boolean)
            .join(' · ');
    // Under the name: age · village · city (age only while alive and not private).
    const facts = [
        !privateDetails && !late && member.dob && age(member.dob) != null ? t('members.profile.age', { n: age(member.dob) }) : null,
        member.village,
        member.city,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div>
            <HeaderBack href="/members" label={t('members.title')} />
            {/* Profile header: navy card like a group's — picture, name, how they are to me, quick actions. */}
            <div className="relative mb-3 overflow-hidden rounded-lg bg-brand-navy text-white shadow-sm">
                <div className="flex items-start gap-3 px-3 pt-3 sm:items-center sm:gap-4 sm:px-5 sm:pt-5">
                    <span
                        aria-hidden
                        className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-2xl font-bold text-white shadow ring-2 ring-white/30 sm:size-20 sm:text-3xl ${
                            late ? 'from-gray-300 to-gray-500' : member.gender === 'female' ? 'from-rose-400 to-rose-600' : 'from-[#5a76a8] to-[#2b4a7e]'
                        }`}
                    >
                        {initialOf(name)}
                    </span>
                    <div className="min-w-0 flex-1 pr-9">
                        <h1 className="pr-1 text-lg leading-snug font-semibold break-words sm:text-2xl">{name}</h1>
                        {/* white/70 on navy: 7.34:1 */}
                        {otherName && otherName !== name && <p className="text-sm break-words text-white/70">{otherName}</p>}
                        {maiden && maiden !== name && (
                            <p className="text-xs break-words text-white/70">
                                {t('members.maidenName')}: {maiden}
                            </p>
                        )}
                        {facts && <p className="mt-0.5 text-xs text-white/70 sm:text-sm">{facts}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {isMe ? (
                                <span className="rounded-full bg-brand-orange-strong px-2 py-0.5 text-[11px] font-semibold text-white">{t('kin.you')}</span>
                            ) : (
                                kin && (
                                    <span className="rounded-full bg-brand-orange-strong px-2 py-0.5 text-[11px] font-semibold text-white">
                                        {t('members.profile.yourKin', { term: t(`kin.terms.${kin}`) })}
                                    </span>
                                )
                            )}
                            {/* The role as a glass chip: the navy / grey Badge tints vanish on the navy card (an empty gap). */}
                            <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/25 ring-inset">
                                {t(`roles.${member.role}`)}
                            </span>
                            {/* Late: a chip beside the role (not a word before the name, which wrapped badly on phones). */}
                            {late && (
                                <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                    {t('status.deceased')}
                                </span>
                            )}
                            {member.status !== 'active' && !late && <Badge status={member.status}>{t(`status.${member.status}`)}</Badge>}
                            {pushCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                    <BellRing className="size-3" /> {t('push.devices.on')}
                                </span>
                            )}
                            {member.blood_group && <BloodBadge group={member.blood_group} />}
                            {member.is_blood_donor && !late ? <Badge tone="blood">{t('members.donor')}</Badge> : null}
                            {canInviteMembers(user.role) && !member.last_login_at && !late && <Badge tone="amber">{t('groups.invite.notJoined')}</Badge>}
                        </div>
                    </div>
                    <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3">
                        {/* Top-right corner of the card, whatever the height of the name block. */}
                        <PageMenu
                            glass
                            items={[
                                // Edit only here; Family tree is a card button, so not repeated.
                                canOpenEdit && { key: 'edit', label: t('common.edit'), icon: 'pencil', href: `/members/${member.id}/edit` },
                                // Each device with notifications on: turned on when, last notification when; remove one.
                                seesPush && { key: 'push-devices', label: t('push.devices.menu'), icon: 'bell' },
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
                        >
                            {seesPush && <PushDevicesDialog userId={member.id} menuKey="push-devices" />}
                        </PageMenu>
                    </div>
                </div>
                {/* Quick actions: Call (the number) + WhatsApp when the number may be seen, Directions when a home pin is set,
                    and the family tree. On phones Call fills the row and the others are icon-only squares (labelled from sm);
                    without Call they keep their labels. Edit lives in the ⋮ menu. */}
                <div className="mt-3 flex gap-2 border-t border-white/10 px-3 py-2.5 sm:mt-4 sm:px-5 sm:py-3">
                    {callable && (
                        <>
                            <a href={`tel:${phone}`} className={callBtn}>
                                <Phone className="size-4 shrink-0" />
                                <span className="truncate tabular-nums">{formatPhone(phone)}</span>
                            </a>
                            <a
                                href={`https://wa.me/${waNumber(phone)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${glassBtn} w-10 shrink-0 sm:w-auto sm:px-3`}
                                aria-label="WhatsApp"
                                title="WhatsApp"
                            >
                                <MessageCircle className="size-4 shrink-0" />
                                <span className="hidden sm:inline">WhatsApp</span>
                            </a>
                        </>
                    )}
                    {pin && (
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${pin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t('home.directions')}
                            title={t('home.directions')}
                            className={`${glassBtn} ${callable ? 'w-10 shrink-0 sm:w-auto sm:px-3' : 'px-3'}`}
                        >
                            <Navigation className="size-4 shrink-0" />
                            <span className={callable ? 'hidden sm:inline' : ''}>{t('home.directions')}</span>
                        </a>
                    )}
                    {/* Without Call it keeps its label on phones too. */}
                    <Link
                        href={`/members/${member.id}/tree`}
                        aria-label={t('members.familyTree')}
                        title={t('members.familyTree')}
                        className={`${glassBtn} ${callable ? 'w-10 shrink-0 sm:w-auto sm:px-3' : 'px-3'}`}
                    >
                        <LinkIconSpinner>
                            <GitFork className="size-4" />
                        </LinkIconSpinner>
                        <span className={callable ? 'hidden sm:inline' : ''}>{t('members.familyTree')}</span>
                    </Link>
                </div>
            </div>

            {/* No login yet (e.g. added from a family tree without a number): tell those who can fix it. */}
            {!member.can_login && !late && canEdit && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {t('members.noLogin')}{' '}
                    <Link href={`/members/${member.id}/edit`} className="font-medium underline">
                        {t('common.edit')}
                    </Link>
                </p>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                    {/* About: only what is filled. A relative added from a family tree keeps birth date and marital status in the family. */}
                    <DetailsCard
                        title={t('members.details')}
                        editHref={editHref}
                        t={t}
                        rows={[
                            { key: 'gender', label: t('members.gender'), value: member.gender && t(`gender.${member.gender}`) },
                            {
                                key: 'dob',
                                label: t('members.dob'),
                                value: !privateDetails && member.dob && (late ? date(member.dob, locale) : `${date(member.dob, locale)} · ${age(member.dob)}`),
                            },
                            {
                                key: 'marital',
                                label: t('family.maritalStatus'),
                                value: !privateDetails && member.marital_status && t(`family.marital.${member.marital_status}`),
                            },
                            { key: 'caste', label: t('members.caste'), value: caste },
                            { key: 'position', label: t('members.position'), value: m.position },
                            { key: 'occupation', label: t('members.occupation'), value: m.occupation },
                            { key: 'education', label: t('members.education'), value: m.education },
                            m.bio && { key: 'bio', label: t('members.bio'), value: <span className="whitespace-pre-line">{m.bio}</span>, wide: true },
                        ]}
                    />
                    {/* Contact & place: the same family-only rule covers the other mobile and email as the main number. */}
                    <DetailsCard
                        title={t('members.parts.contact')}
                        editHref={editHref}
                        t={t}
                        rows={[
                            {
                                key: 'phone',
                                label: t('members.phone'),
                                value: phone && (
                                    <a href={`tel:${phone}`} className="text-primary tabular-nums hover:underline">
                                        {formatPhone(phone)}
                                    </a>
                                ),
                            },
                            {
                                key: 'alt',
                                label: t('members.altPhone'),
                                value: !privateDetails && contactOk && m.alt_phone && (
                                    <a href={`tel:${m.alt_phone}`} className="text-primary tabular-nums hover:underline">
                                        {m.alt_phone}
                                    </a>
                                ),
                            },
                            {
                                key: 'email',
                                label: t('members.email'),
                                value: !privateDetails && m.email && (
                                    <a href={`mailto:${m.email}`} className="text-primary hover:underline">
                                        {m.email}
                                    </a>
                                ),
                            },
                            { key: 'village', label: t('members.village'), value: member.village },
                            { key: 'city', label: t('members.city'), value: member.city },
                            // Lives abroad: the country (empty = India, not shown).
                            { key: 'country', label: t('members.country'), value: m.country && countryName(m.country, locale) },
                            {
                                key: 'address',
                                label: t('members.address'),
                                wide: true,
                                // Copy / Map (Google Maps; the exact home pin when set, else the address + city when it lacks it).
                                value: m.address && (
                                    <AddressActions
                                        address={m.address}
                                        query={
                                            m.home_lat && m.home_lng
                                                ? `${m.home_lat},${m.home_lng}`
                                                : member.city && !m.address.toLowerCase().includes(String(member.city).toLowerCase())
                                                  ? `${m.address}, ${member.city}`
                                                  : m.address
                                        }
                                    />
                                ),
                            },
                        ]}
                    />
                </div>

                <div className="space-y-4">
                    <FamilySummary
                        person={member}
                        relatives={relatives}
                        canSee={seeFamily}
                        canEdit={seeFamily}
                        canAddPhone={canAddPhone}
                        relation={relation}
                        t={t}
                        locale={locale}
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
            {/* Who added this profile, and when — small, the page's last line (bottom right). */}
            {(seesAddedBy || addedByMe) && (
                <p className="mt-3 text-right text-[11px] text-ink-gray">
                    {addedByMe ? (
                        t('members.addedByYou')
                    ) : addedBy ? (
                        <>
                            {t('members.addedBy')}{' '}
                            <Link href={`/members/${addedBy.id}`} className="font-medium text-primary hover:underline">
                                {localized(addedBy, 'full_name', locale)}
                            </Link>
                        </>
                    ) : (
                        t('members.joined')
                    )}
                    {member.created_at && <> · {date(String(member.created_at).slice(0, 10), locale)}</>}
                </p>
            )}
        </div>
    );
}
