import { MapPin, Plus } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import GroupFilter from '@/components/fundraise/group-filter';
import PageHeader, { LinkButton, StatCard } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { adminGroupIds } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { date, money } from '@/lib/format';
import {
    CAMPAIGN_STATUSES,
    listCampaigns,
    listGroupsForSelect,
    locationCounts,
    myContributions,
    myTeamCampaigns,
    progressPct,
    userVillage,
} from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageAllFundraises } from '@/lib/roles';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { buildHref, sp1 } from '@/lib/url';

const VIEWS = ['mine', 'team']; // the default feed is the ABSENCE of ?view=

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('fundraise.title') };
}

/** Clamp rather than trust: unknown values fall back to the default (absence). */
function resolveFilters(sp) {
    const status = CAMPAIGN_STATUSES.includes(sp1(sp.status)) ? sp1(sp.status) : '';
    const g = Number.parseInt(sp1(sp.group), 10);
    return {
        view: VIEWS.includes(sp1(sp.view)) ? sp1(sp.view) : '',
        status,
        groupId: Number.isInteger(g) && g > 0 ? g : null,
        location: sp1(sp.location).slice(0, 100),
        page: normalizePage(sp1(sp.page)),
    };
}

export default async function FundraiseListPage({ searchParams }) {
    const sp = await searchParams;
    const user = await requireUser();
    const { t, locale } = await getT();
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const f = resolveFilters(sp);
    const myAdminGroups = await adminGroupIds(user.id);
    const canCreate = canManageAllFundraises(user.role) || myAdminGroups.length > 0;

    const views = [
        { value: '', label: t('fundraise.views.all') },
        { value: 'mine', label: t('fundraise.views.mine') },
        { value: 'team', label: t('fundraise.views.team') },
    ];

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={t('fundraise.title')}
                subtitle={t('fundraise.subtitle')}
                actions={
                    canCreate && (
                        <LinkButton href="/fundraise/new" icon={Plus} className="w-full sm:w-auto">
                            {t('fundraise.add')}
                        </LinkButton>
                    )
                }
            />

            {/* View tabs scroll rather than wrap. Changing view drops the other view's filters. */}
            <div className="scrollbar-none -mx-1 mb-4 flex max-w-full overflow-x-auto px-1">
                <div className="inline-flex shrink-0 rounded-lg border border-surface-border bg-white p-0.5">
                    {views.map((v) => (
                        <Link
                            key={v.value || 'all'}
                            href={v.value ? `/fundraise?view=${v.value}` : '/fundraise'}
                            scroll={false}
                            aria-current={f.view === v.value ? 'page' : undefined}
                            className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-xs font-medium ${
                                f.view === v.value ? 'bg-primary text-primary-foreground' : 'text-ink-gray hover:bg-accent hover:text-primary'
                            }`}
                        >
                            {v.label}
                        </Link>
                    ))}
                </div>
            </div>

            {f.view === 'mine' && <MyDonations user={user} sp={sp} page={f.page} perPage={perPage} t={t} locale={locale} />}
            {f.view === 'team' && <MyTeams user={user} t={t} locale={locale} />}
            {f.view === '' && <Feed user={user} sp={sp} f={f} perPage={perPage} t={t} locale={locale} />}
        </div>
    );
}

// ── feed ──────────────────────────────────────────────────────────────────────

async function Feed({ user, sp, f, perPage, t, locale }) {
    const village = await userVillage(user.id);
    const [{ rows, total }, groups, locations] = await Promise.all([
        listCampaigns(user, { ...f, village, perPage }),
        listGroupsForSelect(),
        locationCounts(user),
    ]);
    const statusTabs = [
        { value: '', label: t('fundraise.allStatuses') },
        ...CAMPAIGN_STATUSES.map((s) => ({ value: s, label: t(`fundraise.${s}`) })),
    ];
    // "Near you" only means something while no explicit location is chosen.
    const near = f.location ? [] : rows.filter((r) => r.near);
    const rest = f.location ? rows : rows.filter((r) => !r.near);

    return (
        <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex flex-wrap rounded-md bg-surface-bggray/70 p-0.5">
                    {statusTabs.map((s) => {
                        const active = f.status === s.value;
                        return (
                            <Link
                                key={s.value || 'all'}
                                href={buildHref('/fundraise', sp, { status: s.value || null, page: null })}
                                scroll={false}
                                aria-current={active ? 'true' : undefined}
                                className={`inline-flex h-8 shrink-0 items-center rounded px-2.5 text-xs font-medium ${
                                    active ? 'bg-white text-primary shadow-sm ring-1 ring-surface-border' : 'text-ink-gray hover:text-primary'
                                }`}
                            >
                                {s.label}
                            </Link>
                        );
                    })}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                    {locations.length > 0 && (
                        <GroupFilter
                            param="location"
                            options={locations.map((l) => ({ value: l.location, label: `${l.location} (${l.n})` }))}
                            allLabel={t('fundraise.allLocations')}
                        />
                    )}
                    {groups.length > 0 && (
                        <GroupFilter
                            param="group"
                            options={groups.map((g) => ({ value: String(g.id), label: (locale === 'gu' && g.name_gu) || g.name }))}
                            allLabel={t('fundraise.allGroups')}
                        />
                    )}
                </div>
            </div>

            {near.length > 0 && (
                <>
                    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <MapPin className="size-4" /> {t('fundraise.nearYou')} · {village}
                    </h2>
                    <CampaignTable rows={near} t={t} locale={locale} className="mb-5" />
                    {rest.length > 0 && <h2 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.otherFundraises')}</h2>}
                </>
            )}
            {(rest.length > 0 || near.length === 0) && (
                <CampaignTable
                    rows={rest}
                    t={t}
                    locale={locale}
                    empty={f.status || f.groupId || f.location ? t('common.noResults') : t('fundraise.empty')}
                />
            )}
            <Pagination pathname="/fundraise" searchParams={sp} page={f.page} perPage={perPage} total={total} t={t} />
        </>
    );
}

function CampaignTable({ rows, t, locale, empty, className = '', roleColumn = false }) {
    return (
        <TableShell className={className}>
            <THead>
                <Th>{t('fundraise.name')}</Th>
                <Th className="hidden md:table-cell">{t('fundraise.location')}</Th>
                <Th className="hidden lg:table-cell">{t('fundraise.dates')}</Th>
                <Th numeric>{t('fundraise.collected')}</Th>
                <Th numeric className="hidden sm:table-cell">
                    {t('fundraise.spent')}
                </Th>
                <Th>{roleColumn ? t('fundraise.yourRole') : t('fundraise.status')}</Th>
            </THead>
            <tbody>
                {rows.length === 0 ? (
                    <EmptyRow colSpan={6}>{empty}</EmptyRow>
                ) : (
                    rows.map((c) => {
                        const pct = progressPct(c);
                        const groupName = c.group_id ? localized({ name: c.group_name, name_gu: c.group_name_gu }, 'name', locale) : '';
                        return (
                            <Tr key={c.id}>
                                <Td>
                                    <Link href={`/fundraise/${c.id}`} className="font-medium text-primary hover:underline">
                                        {localized(c, 'title', locale)}
                                    </Link>
                                    {/* Location repeats here for phones, where its column is hidden. */}
                                    <span className="block text-xs text-ink-gray">{[groupName, c.location].filter(Boolean).join(' · ')}</span>
                                    {pct != null && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-bggray">
                                                <div className="h-full bg-brand-orange" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-xs text-ink-gray tabular-nums">{pct}%</span>
                                        </div>
                                    )}
                                </Td>
                                <Td className="hidden md:table-cell">{c.location || null}</Td>
                                <Td className="hidden text-xs text-ink-gray lg:table-cell">
                                    {c.start_date || c.end_date ? `${date(c.start_date, locale)} – ${date(c.end_date, locale)}` : null}
                                </Td>
                                <Td numeric className="font-medium text-emerald-700">
                                    {money(c.collected)}
                                </Td>
                                <Td numeric className="hidden text-rose-700 sm:table-cell">
                                    {money(c.spent)}
                                </Td>
                                <Td>
                                    {roleColumn ? (
                                        <Badge tone="orange">{t(`fundraise.teamRoles.${c.member_role}`)}</Badge>
                                    ) : (
                                        <Badge status={c.status}>{t(`fundraise.${c.status}`)}</Badge>
                                    )}
                                </Td>
                            </Tr>
                        );
                    })
                )}
            </tbody>
        </TableShell>
    );
}

// ── my donations ──────────────────────────────────────────────────────────────

async function MyDonations({ user, sp, page, perPage, t, locale }) {
    const { rows, total, amount, campaigns } = await myContributions(user.id, { page, perPage });
    return (
        <>
            <div className="mb-4 sm:max-w-xs">
                <StatCard label={t('fundraise.myTotal')} value={money(amount)} tone="text-emerald-700" />
                <p className="mt-1 text-xs text-ink-gray">{t('fundraise.myTotalNote', { count: campaigns })}</p>
            </div>
            <TableShell>
                <THead>
                    <Th>{t('fundraise.paidOn')}</Th>
                    <Th>{t('fundraise.fundraise')}</Th>
                    <Th className="hidden sm:table-cell">{t('fundraise.mode')}</Th>
                    <Th numeric>{t('fundraise.amount')}</Th>
                </THead>
                <tbody>
                    {rows.length === 0 ? (
                        <EmptyRow colSpan={4}>{t('fundraise.noMyDonations')}</EmptyRow>
                    ) : (
                        rows.map((r) => (
                            <Tr key={r.id}>
                                <Td className="whitespace-nowrap text-ink-gray">{date(r.paid_on, locale)}</Td>
                                <Td>
                                    <Link href={`/fundraise/${r.campaign_id}`} className="font-medium text-primary hover:underline">
                                        {localized(r, 'title', locale)}
                                    </Link>
                                    {r.location && <span className="block text-xs text-ink-gray">{r.location}</span>}
                                </Td>
                                <Td className="hidden sm:table-cell">{t(`fundraise.modes.${r.mode}`)}</Td>
                                <Td numeric className="font-medium text-emerald-700">
                                    {money(r.amount)}
                                </Td>
                            </Tr>
                        ))
                    )}
                </tbody>
                {rows.length > 0 && (
                    <tfoot>
                        <tr className="border-t border-surface-border bg-surface-login font-semibold">
                            <td className="px-4 py-3 text-primary" colSpan={2}>
                                {t('common.total')}
                            </td>
                            <td className="hidden sm:table-cell" />
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(amount)}</td>
                        </tr>
                    </tfoot>
                )}
            </TableShell>
            <Pagination pathname="/fundraise" searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
        </>
    );
}

// ── my teams ──────────────────────────────────────────────────────────────────

async function MyTeams({ user, t, locale }) {
    const rows = await myTeamCampaigns(user.id);
    return <CampaignTable rows={rows} t={t} locale={locale} roleColumn empty={t('fundraise.noMyTeams')} />;
}
