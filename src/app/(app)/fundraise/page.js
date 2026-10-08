import { Sparkles, Plus } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import FilterBar from '@/components/ui/filter-bar';
import CampaignRowMenu from '@/components/fundraise/campaign-row-menu';
import GroupAvatar from '@/components/groups/group-avatar';
import { DOT_SIZE_SM, FUNDRAISE_STATUS_DOT } from '@/lib/status-dot';
import PageHeader, { LinkButton, StatCard } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { requireUser } from '@/lib/auth';
import { date, money } from '@/lib/format';
import {
    CAMPAIGN_STATUSES,
    listCampaigns,
    listGroupsForSelect,
    myContributions,
    myTeamCampaigns,
    progressPct,
} from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { canManageAllFundraises } from '@/lib/roles';
import { getT } from '@/lib/i18n/server';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { buildHref, sp1 } from '@/lib/url';

const VIEWS = ['mine', 'team', 'archived']; // the default feed is the ABSENCE of ?view=; archived = project admins

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
        q: String(sp1(sp.q) ?? '').trim().slice(0, 100),
        page: normalizePage(sp1(sp.page)),
    };
}

export default async function FundraiseListPage({ searchParams }) {
    const sp = await searchParams;
    const user = await requireUser();
    const { t, locale } = await getT();
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const f = resolveFilters(sp);

    const views = [
        { value: 'mine', label: t('fundraise.views.mine') },
        { value: 'team', label: t('fundraise.views.team') },
        ...(canManageAllFundraises(user.role) ? [{ value: 'archived', label: t('fundraise.views.archived') }] : []),
    ];
    const groups = f.view === '' ? await listGroupsForSelect() : [];
    const feedOnly = { param: 'view', value: '' };

    return (
        <div className="theme-fundraise">
            {/* Fundraise managers start a standalone fundraise here; group fundraises start from their group. */}
            <PageHeader
                title={t('fundraise.title')}
                subtitle={t('fundraise.subtitle')}
                actions={
                    canManageAllFundraises(user.role) && (
                        <LinkButton href="/fundraise/new" icon={Plus}>
                            {t('fundraise.add')}
                        </LinkButton>
                    )
                }
            />

            {/* View, status and group sit in the Filters panel; status and group only mean
                something on the all-fundraises view, so they show (and apply) only there. */}
            <FilterBar
                search={f.view === '' ? { placeholder: t('fundraise.searchPlaceholder') } : undefined}
                filters={[
                    { param: 'view', label: t('fundraise.views.label'), type: 'select', allLabel: t('fundraise.views.all'), options: views },
                    {
                        param: 'status',
                        label: t('fundraise.status'),
                        type: 'select',
                        allLabel: t('fundraise.allStatuses'),
                        options: CAMPAIGN_STATUSES.map((st) => ({ value: st, label: t(`fundraise.${st}`) })),
                        showIf: feedOnly,
                    },
                    ...(groups.length > 0
                        ? [
                              {
                                  param: 'group',
                                  label: t('fundraise.group'),
                                  type: 'select',
                                  allLabel: t('fundraise.allGroups'),
                                  options: groups.map((g) => ({ value: String(g.id), label: (locale !== 'en' && g.name_local) || g.name })),
                                  showIf: feedOnly,
                              },
                          ]
                        : []),
                ]}
                left={f.view ? <span className="text-sm font-semibold text-primary">{views.find((v) => v.value === f.view)?.label}</span> : null}
            />

            {f.view === 'mine' && <MyDonations user={user} sp={sp} page={f.page} perPage={perPage} t={t} locale={locale} />}
            {f.view === 'team' && <MyTeams user={user} t={t} locale={locale} />}
            {f.view === '' && <Feed user={user} sp={sp} f={f} perPage={perPage} t={t} locale={locale} />}
            {f.view === 'archived' && canManageAllFundraises(user.role) && (
                <Feed user={user} sp={sp} f={{ ...f, archived: true }} perPage={perPage} t={t} locale={locale} />
            )}
        </div>
    );
}

// ── feed ──────────────────────────────────────────────────────────────────────

async function Feed({ user, sp, f, perPage, t, locale }) {
    const adminMenu = canManageAllFundraises(user.role);
    const { rows, total } = await listCampaigns(user, { ...f, perPage });
    // "For you": any audience rule (surname, caste, sub-caste, village, native place) matches the viewer.
    const forYou = rows.filter((r) => r.for_you);
    const rest = rows.filter((r) => !r.for_you);

    return (
        <>
            {forYou.length > 0 && (
                <>
                    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Sparkles className="size-4" /> {t('fundraise.forYou')}
                    </h2>
                    <p className="-mt-1 mb-2 text-xs text-ink-gray">{t('fundraise.forYouHint')}</p>
                    <CampaignTable rows={forYou} t={t} locale={locale} className="mb-5" adminMenu={adminMenu} />
                    {rest.length > 0 && <h2 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.otherFundraises')}</h2>}
                </>
            )}
            {(rest.length > 0 || forYou.length === 0) && (
                <CampaignTable
                    rows={rest}
                    t={t}
                    locale={locale}
                    adminMenu={adminMenu}
                    empty={f.status || f.groupId || f.q ? t('common.noResults') : t('fundraise.empty')}
                />
            )}
            <Pagination pathname="/fundraise" searchParams={sp} page={f.page} perPage={perPage} total={total} t={t} />
        </>
    );
}

/** adminMenu: project admins get a row kebab (open a tab, edit, public page, delete). */
function CampaignTable({ rows, t, locale, empty, className = '', roleColumn = false, adminMenu = false }) {
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
                {adminMenu && (
                    <Th className="w-12">
                        <span className="sr-only">{t('common.actions')}</span>
                    </Th>
                )}
            </THead>
            <tbody>
                {rows.length === 0 ? (
                    <EmptyRow colSpan={adminMenu ? 7 : 6}>{empty}</EmptyRow>
                ) : (
                    rows.map((c) => {
                        const pct = progressPct(c);
                        const groupName = c.group_id ? localized({ name: c.group_name, name_local: c.group_name_local }, 'name', locale) : '';
                        return (
                            <Tr key={c.id}>
                                <Td>
                                    <div className="flex items-start gap-2.5">
                                    {/* Status dot, as on the fundraise page: green active, grey draft, red closed. */}
                                    <span className="relative shrink-0" title={t(`fundraise.${c.status}`)}>
                                        <GroupAvatar id={c.id} name={c.title} kind={c.avatar?.avatar_kind} value={c.avatar?.avatar_value} color={c.avatar?.avatar_color} size="sm" />
                                        <span
                                            role="img"
                                            aria-label={t(`fundraise.${c.status}`)}
                                            className={`absolute -right-px -bottom-px ${DOT_SIZE_SM} rounded-full ring-2 ring-white ${FUNDRAISE_STATUS_DOT[c.status] ?? FUNDRAISE_STATUS_DOT.draft}`}
                                        />
                                    </span>
                                    <div className="min-w-0">
                                    <Link href={`/${c.kind === 'mandal' ? 'mandal' : 'fundraise'}/${c.id}`} className="font-medium text-primary hover:underline">
                                        {localized(c, 'title', locale)}
                                    </Link>
                                    {c.kind === 'mandal' && (
                                        <Badge tone="orange" className="ml-1.5 align-middle">
                                            {t('mandal.badge')}
                                        </Badge>
                                    )}
                                    {/* Location repeats here for phones, where its column is hidden. */}
                                    <span className="block text-xs text-ink-gray">{[groupName, c.location || c.latest_place].filter(Boolean).join(' · ')}</span>
                                    {pct != null && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-bggray">
                                                <div className="h-full bg-brand-orange" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-xs text-ink-gray tabular-nums">{pct}%</span>
                                        </div>
                                    )}
                                    </div>
                                    </div>
                                </Td>
                                <Td className="hidden md:table-cell">{c.location || c.latest_place || null}</Td>
                                <Td className="hidden text-xs text-ink-gray lg:table-cell">
                                    {c.start_date || c.end_date ? `${date(c.start_date, locale)} – ${date(c.end_date, locale)}` : null}
                                </Td>
                                <Td numeric className="font-medium text-income">
                                    {money(c.collected)}
                                </Td>
                                <Td numeric className="hidden text-expense sm:table-cell">
                                    {money(c.spent)}
                                </Td>
                                <Td>
                                    {roleColumn ? (
                                        <Badge tone="orange">{(c.roles?.length ? c.roles : [c.member_role]).map((r) => t(`fundraise.teamRoles.${r}`)).join(', ')}</Badge>
                                    ) : (
                                        <Badge status={c.status}>{t(`fundraise.${c.status}`)}</Badge>
                                    )}
                                </Td>
                                {adminMenu && (
                                    <Td className="text-right">
                                        <CampaignRowMenu id={c.id} publicToken={c.public_token} isPublic={Boolean(c.is_public)} archived={Boolean(c.archived_at)} />
                                    </Td>
                                )}
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
                <StatCard label={t('fundraise.myTotal')} value={money(amount)} tone="text-income" />
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
                                <Td numeric className="font-medium text-income">
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
                            <td className="px-4 py-3 text-right tabular-nums text-income">{money(amount)}</td>
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
