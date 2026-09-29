import { Phone, Users } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import DonorFilter from '@/components/blood/donor-filter';
import PostRequestButton from '@/components/blood/post-request-button';
import RequestActions from '@/components/blood/request-actions';
import Badge, { BloodBadge } from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { requireUser } from '@/lib/auth';
import { listDonors, listRequests, resolveBloodFilters } from '@/lib/blood';
import { date } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { formatPhone } from '@/lib/phone';
import { canManageMembers } from '@/lib/roles';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { buildHref } from '@/lib/url';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('blood.title') };
}

const segBase = 'inline-flex h-8 shrink-0 items-center rounded px-2.5 text-xs font-medium';
const segOn = `${segBase} seg-active shadow-sm`;
const segOff = `${segBase} text-ink-gray hover:text-primary`;

export default async function BloodPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const f = resolveBloodFilters(sp);
    const pathname = '/blood';

    const tabs = [
        { key: 'requests', label: t('blood.requests') },
        { key: 'donors', label: t('blood.findDonors') },
    ];

    return (
        <div className="theme-blood">
            <PageHeader title={t('blood.title')} subtitle={t('blood.subtitle')} actions={<PostRequestButton />} />

            {/* Tabs scroll rather than wrap (DESIGN.md §5). Links: the server renders the view asked for. */}
            <div className="mb-4 overflow-x-auto scrollbar-none">
                <div className="inline-flex rounded-lg border border-surface-border bg-white p-0.5">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.key}
                            href={tab.key === 'requests' ? pathname : buildHref(pathname, {}, { tab: 'donors' })}
                            scroll={false}
                            aria-current={f.tab === tab.key ? 'page' : undefined}
                            className={`inline-flex h-9 shrink-0 items-center rounded-md px-4 text-sm font-medium ${
                                f.tab === tab.key ? 'seg-active' : 'text-ink-gray hover:bg-accent hover:text-primary'
                            }`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>
            </div>

            {f.tab === 'requests' ? (
                <Requests user={user} f={f} sp={sp} t={t} locale={locale} pathname={pathname} />
            ) : (
                <Donors f={f} t={t} locale={locale} />
            )}
        </div>
    );
}

async function Requests({ user, f, sp, t, locale, pathname }) {
    const page = normalizePage(sp.page);
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const { total, rows } = await listRequests({ status: f.status, page, perPage });
    const manager = canManageMembers(user.role);

    const statuses = [
        { key: 'open', label: t('blood.open') },
        { key: 'fulfilled', label: t('blood.fulfilled') },
        { key: 'cancelled', label: t('blood.cancelled') },
        { key: 'all', label: t('common.all') },
    ];

    return (
        <>
            <div className="mb-3 inline-flex flex-wrap rounded-md bg-surface-bggray/70 p-0.5">
                {statuses.map((s) => (
                    <Link
                        key={s.key}
                        // open is the default → absence of the param; any filter resets the page.
                        href={buildHref(pathname, sp, { status: s.key === 'open' ? null : s.key, page: null })}
                        scroll={false}
                        replace
                        className={f.status === s.key ? segOn : segOff}
                    >
                        {s.label}
                    </Link>
                ))}
            </div>

            <TableShell>
                <THead>
                    <Th>{t('members.bloodGroup')}</Th>
                    <Th>{t('blood.patient')}</Th>
                    <Th>{t('blood.hospital')}</Th>
                    <Th>{t('blood.neededBy')}</Th>
                    <Th>{t('blood.contact')}</Th>
                    <Th>{t('blood.status')}</Th>
                    <Th className="w-10">
                        <span className="sr-only">{t('common.actions')}</span>
                    </Th>
                </THead>
                <tbody>
                    {rows.length === 0 && <EmptyRow colSpan={7}>{t('blood.empty')}</EmptyRow>}
                    {rows.map((r) => (
                        <Tr key={r.id}>
                            <Td>
                                <BloodBadge group={r.blood_group} />
                            </Td>
                            <Td className="max-w-56">
                                <span className="font-medium text-primary">{r.patient_name}</span>
                                <span className="block text-xs text-ink-gray tabular-nums">
                                    {r.units} {t('blood.units')}
                                </span>
                                {r.notes && <span className="mt-0.5 block text-xs text-ink-gray">{r.notes}</span>}
                            </Td>
                            <Td className="max-w-56">
                                {r.hospital || r.city ? [r.hospital, r.city].filter(Boolean).join(', ') : null}
                            </Td>
                            <Td className="whitespace-nowrap">{r.needed_by ? date(r.needed_by, locale) : null}</Td>
                            <Td className="whitespace-nowrap">
                                <a
                                    href={`tel:${r.contact_phone}`}
                                    className="inline-flex items-center gap-1 font-medium text-primary tabular-nums hover:underline"
                                >
                                    <Phone className="size-3.5" /> {formatPhone(r.contact_phone)}
                                </a>
                            </Td>
                            <Td>
                                <Badge status={r.status}>{t(`blood.${r.status}`)}</Badge>
                            </Td>
                            <Td className="whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                    {r.status === 'open' && (
                                        <Link
                                            href={buildHref(pathname, {}, { tab: 'donors', group: r.blood_group, compatible: 1 })}
                                            title={t('blood.showDonors')}
                                            className="inline-flex h-8 items-center gap-1 rounded-md btn-secondary px-2 text-xs font-medium"
                                        >
                                            <Users className="size-3.5" />
                                            <span className="hidden sm:inline">{t('blood.showDonors')}</span>
                                        </Link>
                                    )}
                                    {(manager || r.created_by === user.id) && <RequestActions id={r.id} status={r.status} />}
                                </div>
                            </Td>
                        </Tr>
                    ))}
                </tbody>
            </TableShell>
            <Pagination pathname={pathname} searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
        </>
    );
}

async function Donors({ f, t, locale }) {
    const donors = await listDonors(f);
    return (
        <div className="space-y-4">
            <DonorFilter group={f.group} compatible={f.compatible} village={f.village} />
            {f.group && (
                <p className="text-xs text-ink-gray">
                    {t('blood.donorsFor', { group: f.group })} · {t('members.count', { count: donors.length })}
                </p>
            )}
            <TableShell>
                <THead>
                    <Th>{t('members.fullName')}</Th>
                    <Th>{t('members.bloodGroup')}</Th>
                    <Th>{t('members.village')}</Th>
                    <Th>{t('members.phone')}</Th>
                </THead>
                <tbody>
                    {!f.group && <EmptyRow colSpan={4}>{t('blood.pickGroup')}</EmptyRow>}
                    {f.group && donors.length === 0 && <EmptyRow colSpan={4}>{t('blood.noDonors')}</EmptyRow>}
                    {donors.map((d) => (
                        <Tr key={d.id}>
                            <Td className="max-w-64">
                                <Link href={`/members/${d.id}`} className="font-medium text-primary hover:underline">
                                    {localized(d, 'full_name', locale)}
                                </Link>
                            </Td>
                            <Td>
                                <BloodBadge group={d.blood_group} />
                            </Td>
                            <Td>{d.village || null}</Td>
                            <Td className="whitespace-nowrap">
                                <a
                                    href={`tel:${d.phone}`}
                                    className="inline-flex items-center gap-1 font-medium text-primary tabular-nums hover:underline"
                                >
                                    <Phone className="size-3.5" /> {formatPhone(d.phone)}
                                </a>
                            </Td>
                        </Tr>
                    ))}
                </tbody>
            </TableShell>
        </div>
    );
}
