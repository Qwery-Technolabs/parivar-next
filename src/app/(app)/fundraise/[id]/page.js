import { Archive, ArchiveRestore, CalendarClock, Info, MapPin, MessageCircle, Pencil, Wallet, FileDown } from 'lucide-react';
import { setCampaignArchived } from '@/app/actions/fundraise';
import SubmitButton from '@/components/ui/submit-button';
import { cookies } from 'next/headers';
import HeaderBack from '@/components/shell/header-back';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatPanel from '@/components/chat/chat-panel';
import WaTabs from '@/components/ui/wa-tabs';
import DetailsTab from '@/components/fundraise/details-tab';
import GroupAvatar from '@/components/groups/group-avatar';
import MeetingsSection from '@/components/meetings/meetings-section';
import MoneyTab, { MONEY_VIEWS } from '@/components/fundraise/money-tab';
import MandalTab from '@/components/mandal/mandal-tab';
import { mandalMeetings, mandalMembers, syncMandalMembers } from '@/lib/mandal';
import Badge from '@/components/ui/badge';
import AddToGroups from '@/components/fundraise/add-to-groups';
import { DOT_SIZE, FUNDRAISE_STATUS_DOT } from '@/lib/status-dot';
import { fundraiseGroupIds, fundraisePermissions } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { date, money, time } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import {
    contributorTotals,
    getAudience,
    getCampaign,
    listContributions,
    listExpenses,
    listHistory,
    listTeam,
    canSeeCampaign,
    listGroupsForSelect,
    maskAnonymous,
    listUpdates,
    nextMeeting,
    historyCount,
} from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canManageAllFundraises, canClearChats, canClearHistory } from '@/lib/roles';
import { getSettings } from '@/lib/settings';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { buildHref, sp1 } from '@/lib/url';
import { messageCount as countMessages } from '@/lib/chat';

// Three tabs; the default (Discussion) is the absence of ?tab. Old tab values from
// notifications and bookmarks map onto the tab that now holds them.
const LEGACY = {
    contributions: ['money', 'contributions'],
    expenses: ['money', 'expenses'],
    contributors: ['money', 'contributors'],
    team: ['details'],
    updates: ['details'],
};

function resolveTab(sp) {
    const raw = sp1(sp.tab);
    if (raw === 'money' || raw === 'details' || raw === 'meetings') return { tab: raw, view: sp1(sp.view) };
    // The old Mandal tab now lives in About.
    if (raw === 'mandal') return { tab: 'details', view: '' };
    if (LEGACY[raw]) return { tab: LEGACY[raw][0], view: LEGACY[raw][1] ?? '' };
    return { tab: 'discussion', view: '' };
}

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
    // Outside the fundraise's audience (and not its team / group leaders / managers): it does not exist.
    if (!(await canSeeCampaign(user, campaign.id))) notFound();
    // Drafts stay invisible to everyone who could not manage them (same rule as the list).
    // Archived ones too: out of sight for everyone but managers.
    if ((campaign.status === 'draft' || campaign.archived_at) && !perms.manage) notFound();

    const { t, locale } = await getT();
    const { tab, view: rawView } = resolveTab(sp);
    const view = MONEY_VIEWS.includes(rawView) ? rawView : 'contributions';
    const base = `/fundraise/${campaign.id}`;
    const today = todayLocal();
    const upNext = await nextMeeting(campaign.id, today);
    // A Mandal's pending money = what its members still owe (missed / short payments).
    if (campaign.kind === 'mandal') {
        await syncMandalMembers(campaign);
        const members = await mandalMembers(campaign.id, await mandalMeetings(campaign.id, Number(campaign.meta?.installment) || 0), today);
        campaign.pending = Number(campaign.pending || 0) + members.reduce((s, m) => s + m.due, 0);
    }

    const groupName = localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale);
    const collected = Number(campaign.collected);
    const spent = Number(campaign.spent);
    const tabs = [
        { key: 'discussion', label: t('fundraise.tabs.discussion'), href: base, icon: MessageCircle },
        { key: 'money', label: t('fundraise.tabs.money'), href: `${base}?tab=money`, icon: Wallet },
        { key: 'meetings', label: t('fundraise.tabs.meetings'), href: `${base}?tab=meetings`, icon: CalendarClock },
        { key: 'details', label: t('fundraise.tabs.details'), href: `${base}?tab=details`, icon: Info },
    ];

    let body;
    if (tab === 'money') {
        const page = normalizePage(sp1(sp.page));
        const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
        const offset = (page - 1) * perPage;
        const [rows, settings] = await Promise.all([
            view === 'contributions'
                ? listContributions(campaign.id, { limit: perPage, offset })
                : view === 'expenses'
                  ? listExpenses(campaign.id, { limit: perPage, offset })
                  : contributorTotals(campaign.id, { publicView: !perms.manage }),
            getSettings('fundraise'),
        ]);
        // Anonymous gifts: only managers see who gave (they get the name + an "Anonymous" badge).
        const shown = perms.manage || view === 'expenses' ? rows : maskAnonymous(rows, t('fundraise.anonymousLabel'));
        const total = view === 'contributions' ? campaign.contribution_count : view === 'expenses' ? campaign.expense_count : rows.length;
        body = (
            <MoneyTab
                campaign={campaign}
                view={view}
                rows={shown}
                total={total}
                page={page}
                perPage={perPage}
                perms={perms}
                settings={settings}
                today={today}
                base={base}
                sp={{ ...sp, tab: 'money', view: view === 'contributions' ? undefined : view }}
                t={t}
                locale={locale}
            />
        );
    } else if (tab === 'meetings') {
        // Minutes are updates tied to a meeting; they show under that meeting.
        const updates = await listUpdates(campaign.id);
        body = (
            <MeetingsSection
                scope="fundraise"
                scopeId={campaign.id}
                defaultTitle={`${campaign.title} — ${t('meetings.word')}`}
                defaultPlace={campaign.location ?? ''}
                minutes={updates
                    .filter((u) => u.update_type === 'minutes' && u.event_id)
                    .map((u) => ({ id: u.id, event_id: u.event_id, body: u.body, author: u.author, author_local: u.author_local }))}
                canPostMinutes={perms.post}
            />
        );
    } else if (tab === 'details') {
        const [audience, team, updates, history, messageCount, editCount] = await Promise.all([
            getAudience(campaign.id),
            listTeam(campaign.id),
            listUpdates(campaign.id),
            listHistory(campaign.id, { limit: 50 }),
            countMessages('fundraise', campaign.id),
            historyCount(campaign.id),
        ]);
        body = (
            <>
                {/* A Mandal: its members, schedules (with the money sheet) and who has the money, above the usual About. */}
                {campaign.kind === 'mandal' && <MandalTab campaign={campaign} user={user} today={today} t={t} locale={locale} />}
                <DetailsTab
                    campaign={campaign}
                    audience={audience}
                    team={team}
                    updates={updates}
                    history={history}
                    perms={perms}
                    userId={user.id}
                    today={today}
                    t={t}
                    locale={locale}
                    messageCount={messageCount}
                    // Clear the discussion: app admins / sub-admins and the fundraise's own team admins only.
                    canClearChat={canClearChats(user.role) || perms.teamRole === 'admin'}
                    // Edit history: deleted only by app admins / sub-admins (canClearHistory).
                    historyCount={canClearHistory(user.role) ? editCount : 0}
                />
            </>
        );
    } else {
        // ChatPanel resolves who may read and post (team, group members) itself.
        body = <ChatPanel scope="fundraise" scopeId={campaign.id} />;
    }

    // "Add to group": groups this person may start a fundraise in (all, for fundraise managers)
    // that it is not shown in yet.
    let addableGroups = [];
    if (perms.manage && campaign.kind !== 'mandal') {
        const all = canManageAllFundraises(user.role);
        const [groups, mine] = await Promise.all([listGroupsForSelect(), all ? [] : fundraiseGroupIds(user.id)]);
        const linked = new Set([campaign.group_id, ...(campaign.groups ?? []).map((g) => g.id)]);
        addableGroups = groups
            .filter((g) => !linked.has(g.id) && (all || mine.includes(g.id)))
            .map((g) => ({ value: String(g.id), label: localized(g, 'name', locale) }));
    }

    return (
        // Inside the normal content gutters, like the group page: a rounded header card, then the tab.
        <div className="theme-fundraise">
            {/* Header strip: title, group, one-line totals; then three equal tabs. */}
            <div className="mb-3 overflow-hidden rounded-lg bg-brand-navy text-white shadow-sm">
                <div className="px-3 pt-3 sm:px-4">
                    <HeaderBack
                        href={campaign.group_id ? `/groups/${campaign.group_id}` : '/fundraise'}
                        label={campaign.group_id ? groupName : t('fundraise.title')}
                    />
                    {/* Also shown in other groups: one chip each (the header's back link is the home group). */}
                    {(campaign.groups ?? []).some((g) => g.id !== campaign.group_id) && (
                        <span className="mb-1 flex flex-wrap gap-1">
                            {campaign.groups
                                .filter((g) => g.id !== campaign.group_id)
                                .map((g) => (
                                    <Link
                                        key={g.id}
                                        href={`/groups/${g.id}`}
                                        className="rounded-full bg-white/15 px-2 py-px text-[11px] font-medium text-white hover:bg-white/25"
                                    >
                                        {localized(g, 'name', locale)}
                                    </Link>
                                ))}
                        </span>
                    )}
                    {/* Row 1: picture + title on the left, PDF and Edit pinned top-right (never wrap below). */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            {/* Status = a dot on the picture's bottom-right: green active, grey draft, red closed. */}
                            <span className="relative shrink-0" title={t(`fundraise.${campaign.status}`)}>
                                <GroupAvatar
                                    name={campaign.title}
                                    kind={campaign.meta.avatar_kind}
                                    value={campaign.meta.avatar_value}
                                    color={campaign.meta.avatar_color}
                                    tint="bg-white/15 text-white"
                                    className="ring-2 ring-white/25"
                                />
                                <span
                                    role="img"
                                    aria-label={t(`fundraise.${campaign.status}`)}
                                    className={`absolute right-0 bottom-0 ${DOT_SIZE} rounded-full ring-2 ring-brand-navy ${FUNDRAISE_STATUS_DOT[campaign.status] ?? FUNDRAISE_STATUS_DOT.draft}`}
                                />
                            </span>
                            <h1 className="min-w-0 text-lg font-semibold break-words">{localized(campaign, 'title', locale)}</h1>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {/* Show it in more groups: only when there is a group this person may still add. */}
                            {addableGroups.length > 0 && <AddToGroups campaignId={campaign.id} groups={addableGroups} />}
                            {/* Print / PDF: the statement, for anyone who can see the fundraise. */}
                            <Link
                                href={`${base}/print`}
                                aria-label={t('common.downloadPdf')}
                                title={t('common.downloadPdf')}
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/20"
                            >
                                <FileDown className="size-4" />
                            </Link>
                            {perms.manage && (
                                <Link
                                    href={`${base}/edit`}
                                    // Same as the group page's Edit on navy: icon only on phones.
                                    aria-label={t('common.edit')}
                                    title={t('common.edit')}
                                    className="inline-flex size-9 shrink-0 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 text-sm font-medium text-white hover:bg-white/20 sm:w-auto sm:px-3"
                                >
                                    <Pencil className="size-4" /> <span className="hidden sm:inline">{t('common.edit')}</span>
                                </Link>
                            )}
                        </div>
                    </div>
                    {/* Row 2 (only when needed): Archived on the left; my team role on the right from sm up
                        (phones find the role in the About tab). Status is the dot on the picture. */}
                    {(campaign.archived_at || perms.teamRole) && (
                        <div className={`mt-2 items-center justify-between gap-2 ${campaign.archived_at ? 'flex' : 'hidden sm:flex'}`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {campaign.kind === 'mandal' && <Badge tone="orange">{t('mandal.badge')}</Badge>}
                                {campaign.archived_at && <Badge tone="gray">{t('fundraise.archivedBadge')}</Badge>}
                            </div>
                            {perms.teamRole && (
                                <Badge tone="orange" className="hidden sm:inline-flex">
                                    {t('fundraise.yourRole')}: {t(`fundraise.teamRoles.${perms.teamRole}`)}
                                </Badge>
                            )}
                        </div>
                    )}
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-white/85 tabular-nums">
                        <span>
                            {t('fundraise.collected')}: <b className="text-white">{money(collected)}</b>
                        </span>
                        <span>
                            {t('fundraise.spent')}: <b className="text-white">{money(spent)}</b>
                        </span>
                        <span>
                            {t('fundraise.balance')}: <b className="text-white">{money(collected - spent)}</b>
                        </span>
                        {/* Phones: the target reached, to two decimals (the Income / Expense boxes are hidden there). */}
                        {Number(campaign.target_amount) > 0 && (
                            <span className="sm:hidden">
                                {t('fundraise.target')}: <b className="text-white">{((collected / Number(campaign.target_amount)) * 100).toFixed(2)}%</b>
                            </span>
                        )}
                        {campaign.location && (
                            <span className="inline-flex items-center gap-0.5">
                                <MapPin className="size-3" /> {campaign.location}
                            </span>
                        )}
                    </p>
                    {upNext && (
                        <Link
                            href={`${base}?tab=meetings`}
                            className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
                        >
                            <CalendarClock className="size-3.5 shrink-0" />
                            <span className="font-semibold">{t('fundraise.nextMeeting')}:</span>
                            <span className="min-w-0 truncate">
                                {date(upNext.start_date, locale)}
                                {upNext.start_time && ` · ${time(upNext.start_time)}`}
                                {upNext.location && ` · ${upNext.location}`}
                            </span>
                        </Link>
                    )}
                </div>
                <div className="mt-3">
                    <WaTabs tabs={tabs} active={tab} />
                </div>
            </div>
            {/* Archived (only managers get here): say so, and let a project admin undo it on the spot. */}
            {campaign.archived_at && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-bggray/60 px-3 py-2.5">
                    <Archive className="size-4 shrink-0 text-ink-gray" />
                    <p className="min-w-0 flex-1 text-sm text-ink">{t('fundraise.archivedNotice')}</p>
                    {perms.manage && (
                        <form action={setCampaignArchived.bind(null, campaign.id, false)}>
                            <SubmitButton icon={<ArchiveRestore className="size-4" />} variant="secondary">
                                {t('fundraise.restore')}
                            </SubmitButton>
                        </form>
                    )}
                </div>
            )}
            <div>{body}</div>
        </div>
    );
}
