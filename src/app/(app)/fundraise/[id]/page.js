import { CalendarClock, MapPin, Pencil, Printer } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EntryButtons from '@/components/fundraise/entry-buttons';
import MeetingsPanel from '@/components/fundraise/meetings-panel';
import PublicLinkCard from '@/components/fundraise/public-link-card';
import RowActions from '@/components/fundraise/row-actions';
import FundraiseSummary from '@/components/fundraise/summary';
import TeamPanel from '@/components/fundraise/team-panel';
import UpdatesPanel from '@/components/fundraise/updates-panel';
import PageHeader, { Card, LinkButton } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { fundraisePermissions } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { date, money, time } from '@/lib/format';
import { todayIST } from '@/lib/forms';
import {
    contributorTotals,
    getCampaign,
    listContributions,
    listExpenses,
    listMeetings,
    listTeam,
    listUpdates,
    nextMeeting,
} from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/settings';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { buildHref, sp1 } from '@/lib/url';

const TABS = ['contributions', 'expenses', 'contributors', 'team', 'meetings', 'updates'];
const TABLE_TABS = ['contributions', 'expenses', 'contributors'];

export async function generateMetadata({ params }) {
    const { id } = await params;
    const { locale } = await getT();
    const c = await getCampaign(Number(id));
    return { title: c ? localized(c, 'title', locale) : undefined };
}

export default async function FundraiseDetailPage({ params, searchParams }) {
    const [{ id }, sp] = await Promise.all([params, searchParams]);
    const user = await requireUser();
    const campaign = await getCampaign(Number(id));
    if (!campaign) notFound();

    const perms = await fundraisePermissions(user, campaign);
    const canManage = perms.manage;
    // Drafts stay invisible to everyone who could not manage them (same rule as the list).
    if (campaign.status === 'draft' && !canManage) notFound();

    const { t, locale } = await getT();
    const tab = TABS.includes(sp1(sp.tab)) ? sp1(sp.tab) : 'contributions';
    const page = normalizePage(sp1(sp.page));
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const offset = (page - 1) * perPage;
    const base = `/fundraise/${campaign.id}`;
    const today = todayIST();

    let rows = [];
    let total = 0;
    let team = [];
    let meetings = null;
    let updates = [];
    const [upNext, settings] = await Promise.all([nextMeeting(campaign.id, today), getSettings('fundraise')]);
    if (tab === 'contributions') {
        rows = await listContributions(campaign.id, { limit: perPage, offset });
        total = campaign.contribution_count;
    } else if (tab === 'expenses') {
        rows = await listExpenses(campaign.id, { limit: perPage, offset });
        total = campaign.expense_count;
    } else if (tab === 'contributors') {
        rows = await contributorTotals(campaign.id);
        total = rows.length;
    } else if (tab === 'team') {
        team = await listTeam(campaign.id);
    } else if (tab === 'meetings') {
        [meetings, updates] = await Promise.all([listMeetings(campaign.id, today), listUpdates(campaign.id)]);
    } else {
        updates = await listUpdates(campaign.id);
    }

    const groupName = campaign.group_id ? localized({ name: campaign.group_name, name_gu: campaign.group_name_gu }, 'name', locale) : null;
    const description = localized(campaign.meta, 'description', locale);
    const tabLabel = {
        contributions: t('fundraise.contributions'),
        expenses: t('fundraise.expenses'),
        contributors: t('fundraise.byContributor'),
        team: t('fundraise.tabs.team'),
        meetings: t('fundraise.tabs.meetings'),
        updates: t('fundraise.tabs.updates'),
    };
    const tabCount = { contributions: campaign.contribution_count, expenses: campaign.expense_count };

    return (
        <div className="theme-fundraise space-y-5">
            <PageHeader
                title={localized(campaign, 'title', locale)}
                subtitle={
                    <>
                        {groupName && (
                            <Link href={`/groups/${campaign.group_id}`} className="hover:underline">
                                {groupName}
                            </Link>
                        )}
                        {groupName && (campaign.start_date || campaign.end_date) && ' · '}
                        {(campaign.start_date || campaign.end_date) && `${date(campaign.start_date, locale)} – ${date(campaign.end_date, locale)}`}
                        {campaign.location && (
                            <span className="ml-2 inline-flex items-center gap-0.5">
                                <MapPin className="size-3" /> {campaign.location}
                            </span>
                        )}
                    </>
                }
                back={{ href: '/fundraise', label: t('fundraise.title') }}
                actions={
                    <>
                        <Badge status={campaign.status}>{t(`fundraise.${campaign.status}`)}</Badge>
                        {perms.teamRole && (
                            <Badge tone="orange">
                                {t('fundraise.yourRole')}: {t(`fundraise.teamRoles.${perms.teamRole}`)}
                            </Badge>
                        )}
                        <LinkButton href={`${base}/print`} icon={Printer} variant="outline">
                            {t('common.print')}
                        </LinkButton>
                        {canManage && (
                            <LinkButton href={`${base}/edit`} icon={Pencil} variant="outline">
                                {t('common.edit')}
                            </LinkButton>
                        )}
                    </>
                }
            />

            {upNext && (
                <Link
                    href={`${base}?tab=meetings`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brand-orange/60 bg-orange-50 px-4 py-3 text-sm hover:ring-2 hover:ring-ring/30"
                >
                    <CalendarClock className="size-5 shrink-0 text-primary" />
                    <span className="font-semibold text-primary">{t('fundraise.nextMeeting')}</span>
                    <span className="min-w-0 text-ink break-words">
                        {date(upNext.start_date, locale)}
                        {upNext.start_time && ` · ${time(upNext.start_time)}`}
                        {upNext.location && ` · ${upNext.location}`}
                    </span>
                </Link>
            )}

            <FundraiseSummary campaign={campaign} t={t} />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Tabs scroll rather than wrap — a wrapped tab bar stops reading as one control. */}
                        <div className="scrollbar-none -mx-1 flex max-w-full overflow-x-auto px-1">
                            <div className="inline-flex shrink-0 rounded-lg border border-surface-border bg-white p-0.5">
                                {TABS.map((k) => (
                                    <Link
                                        key={k}
                                        href={buildHref(base, sp, { tab: k === 'contributions' ? null : k, page: null })}
                                        scroll={false}
                                        aria-current={tab === k ? 'page' : undefined}
                                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium ${
                                            tab === k ? 'bg-primary text-primary-foreground' : 'text-ink-gray hover:bg-accent hover:text-primary'
                                        }`}
                                    >
                                        {tabLabel[k]}
                                        {tabCount[k] != null && <span className="tabular-nums opacity-80">{tabCount[k]}</span>}
                                    </Link>
                                ))}
                            </div>
                        </div>
                        {TABLE_TABS.includes(tab) && (perms.contribution || perms.expense) && (
                            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                                <EntryButtons
                                    campaignId={campaign.id}
                                    today={today}
                                    perms={{ contribution: perms.contribution, expense: perms.expense }}
                                    allowAnonymous={settings.allow_anonymous}
                                    categories={settings.expense_categories}
                                />
                            </div>
                        )}
                    </div>

                    {TABLE_TABS.includes(tab) && !perms.contribution && !perms.expense && (
                        <p className="text-xs text-ink-gray">{t('fundraise.viewOnly')}</p>
                    )}

                    {tab === 'team' && <TeamPanel campaignId={campaign.id} team={team} canManage={canManage} />}
                    {tab === 'meetings' && (
                        <MeetingsPanel
                            campaign={campaign}
                            meetings={meetings}
                            updates={updates}
                            perms={perms}
                            userId={user.id}
                            t={t}
                            locale={locale}
                            today={today}
                        />
                    )}
                    {tab === 'updates' && (
                        <UpdatesPanel campaignId={campaign.id} updates={updates} perms={perms} userId={user.id} t={t} locale={locale} />
                    )}

                    {tab === 'contributions' && (
                        <TableShell>
                            <THead>
                                <Th>{t('fundraise.paidOn')}</Th>
                                <Th>{t('fundraise.donor')}</Th>
                                <Th className="hidden sm:table-cell">{t('fundraise.mode')}</Th>
                                <Th numeric>{t('fundraise.amount')}</Th>
                                {canManage && <Th className="w-12" />}
                            </THead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <EmptyRow colSpan={canManage ? 5 : 4}>{t('fundraise.noContributions')}</EmptyRow>
                                ) : (
                                    rows.map((c) => (
                                        <Tr key={c.id}>
                                            <Td className="whitespace-nowrap text-ink-gray">{date(c.paid_on, locale)}</Td>
                                            <Td>
                                                {c.user_id ? (
                                                    <Link href={`/members/${c.user_id}`} className="font-medium text-primary hover:underline">
                                                        {c.donor_name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium text-primary">{c.donor_name}</span>
                                                )}
                                                {c.is_anonymous ? (
                                                    <Badge tone="gray" className="ml-2">
                                                        {t('fundraise.anonymousLabel')}
                                                    </Badge>
                                                ) : null}
                                                {c.reference && <span className="block text-xs text-ink-gray">{c.reference}</span>}
                                            </Td>
                                            <Td className="hidden sm:table-cell">{t(`fundraise.modes.${c.mode}`)}</Td>
                                            <Td numeric className="font-medium text-emerald-700">
                                                {money(c.amount)}
                                            </Td>
                                            {canManage && (
                                                <Td className="w-12 py-1">
                                                    <RowActions kind="contribution" campaignId={campaign.id} rowId={c.id} />
                                                </Td>
                                            )}
                                        </Tr>
                                    ))
                                )}
                            </tbody>
                        </TableShell>
                    )}

                    {tab === 'expenses' && (
                        <TableShell>
                            <THead>
                                <Th>{t('fundraise.spentOn')}</Th>
                                <Th>{t('fundraise.expenseWhat')}</Th>
                                <Th className="hidden md:table-cell">{t('fundraise.expenseWhere')}</Th>
                                <Th numeric>{t('fundraise.amount')}</Th>
                                {canManage && <Th className="w-12" />}
                            </THead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <EmptyRow colSpan={canManage ? 5 : 4}>{t('fundraise.noExpenses')}</EmptyRow>
                                ) : (
                                    rows.map((e) => (
                                        <Tr key={e.id}>
                                            <Td className="whitespace-nowrap text-ink-gray">{date(e.spent_on, locale)}</Td>
                                            <Td>
                                                <span className="font-medium text-primary">{e.title}</span>
                                                {e.category && (
                                                    <Badge tone="navy" className="ml-2">
                                                        {e.category}
                                                    </Badge>
                                                )}
                                                {e.place && <span className="block text-xs text-ink-gray md:hidden">{e.place}</span>}
                                                {(e.bill_ref || e.notes) && (
                                                    <span className="block text-xs text-ink-gray whitespace-pre-line">
                                                        {[e.bill_ref && `${t('fundraise.billRef')}: ${e.bill_ref}`, e.notes].filter(Boolean).join(' · ')}
                                                    </span>
                                                )}
                                            </Td>
                                            <Td className="hidden md:table-cell">{e.place || null}</Td>
                                            <Td numeric className="font-medium text-rose-700">
                                                {money(e.amount)}
                                            </Td>
                                            {canManage && (
                                                <Td className="w-12 py-1">
                                                    <RowActions kind="expense" campaignId={campaign.id} rowId={e.id} />
                                                </Td>
                                            )}
                                        </Tr>
                                    ))
                                )}
                            </tbody>
                        </TableShell>
                    )}

                    {tab === 'contributors' && (
                        <TableShell>
                            <THead>
                                <Th>{t('fundraise.donor')}</Th>
                                <Th numeric>{t('fundraise.entries')}</Th>
                                <Th className="hidden sm:table-cell">{t('fundraise.lastPaid')}</Th>
                                <Th numeric>{t('common.total')}</Th>
                            </THead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <EmptyRow colSpan={4}>{t('fundraise.noContributions')}</EmptyRow>
                                ) : (
                                    rows.map((c) => (
                                        <Tr key={c.k}>
                                            <Td>
                                                {c.user_id ? (
                                                    <Link href={`/members/${c.user_id}`} className="font-medium text-primary hover:underline">
                                                        {c.donor_name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium text-primary">{c.donor_name}</span>
                                                )}
                                            </Td>
                                            <Td numeric>{c.entries}</Td>
                                            <Td className="hidden whitespace-nowrap text-ink-gray sm:table-cell">{date(c.last_paid, locale)}</Td>
                                            <Td numeric className="font-semibold text-emerald-700">
                                                {money(c.total)}
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </tbody>
                        </TableShell>
                    )}

                    {(tab === 'contributions' || tab === 'expenses') && (
                        <Pagination pathname={base} searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
                    )}
                </div>

                <div className="min-w-0 space-y-4">
                    <Card title={t('fundraise.publicLink')}>
                        <PublicLinkCard
                            campaignId={campaign.id}
                            isPublic={Boolean(campaign.is_public)}
                            token={campaign.public_token}
                            canManage={canManage}
                        />
                    </Card>
                    {description && (
                        <Card title={t('fundraise.description')}>
                            <p className="whitespace-pre-line text-sm text-ink break-words">{description}</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
