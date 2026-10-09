import { Archive, ArchiveRestore, CalendarClock, Info, MapPin, MessageCircle, Pencil, Wallet, FileDown, PiggyBank } from 'lucide-react';
import { setCampaignArchived } from '@/app/actions/fundraise';
import SubmitButton from '@/components/ui/submit-button';
import { cookies } from 'next/headers';
import HeaderBack from '@/components/shell/header-back';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ChatPanel from '@/components/chat/chat-panel';
import WaTabs from '@/components/ui/wa-tabs';
import DetailsTab from '@/components/fundraise/details-tab';
import GroupAvatar from '@/components/groups/group-avatar';
import MeetingsSection from '@/components/meetings/meetings-section';
import MoneyTab, { MONEY_VIEWS } from '@/components/fundraise/money-tab';
import { mandalAboutParts, mandalMoneyParts } from '@/components/mandal/mandal-tab';
import { canRunMandal, mandalAttendance, mandalMeetingsOnce, mandalMembersOnce, syncMandalMembers } from '@/lib/mandal';
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
    listHoldings,
    listTeam,
    canSeeCampaign,
    listGroupsForSelect,
    maskAnonymous,
    listUpdates,
    nextMeeting,
    historyCount,
    fundraisePeople,
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

/**
 * One page for both: a fundraise at /fundraise/[id], a Mandal at /mandal/[id] (that route renders
 * this with `asMandal`). The wrong address for the kind redirects to the right one, query kept.
 */
export default async function FundraiseDetailPage({ params, searchParams, asMandal = false }) {
    const [{ id }, sp] = await Promise.all([params, searchParams]);
    // Independent work runs together (speed): who is asking + the fundraise, then the checks, the
    // texts and the next meeting; the Mandal total and "Add to group" list load while the tab does.
    const [user, campaign] = await Promise.all([requireUser(), getCampaign(Number(id))]);
    if (!campaign) notFound();
    const isMandal = campaign.kind === 'mandal';
    if (isMandal !== asMandal) {
        const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]))).toString();
        redirect(`/${isMandal ? 'mandal' : 'fundraise'}/${campaign.id}${qs ? `?${qs}` : ''}`);
    }

    const today = todayLocal();
    const [perms, visible, { t, locale }, upNext] = await Promise.all([
        fundraisePermissions(user, campaign),
        canSeeCampaign(user, campaign.id),
        getT(),
        nextMeeting(campaign.id, today),
    ]);
    // Outside the fundraise's audience (and not its team / group leaders / managers): it does not exist.
    if (!visible) notFound();
    // Drafts stay invisible to everyone who could not manage them (same rule as the list).
    // Archived ones too: out of sight for everyone but managers.
    if ((campaign.status === 'draft' || campaign.archived_at) && !perms.manage) notFound();

    const { tab, view: rawView } = resolveTab(sp);
    const base = `/${isMandal ? 'mandal' : 'fundraise'}/${campaign.id}`;
    // Started now, awaited after the tab's own data (they run side by side).
    // A Mandal's pending money = what its members still owe (missed / short payments).
    const mandalDueP =
        campaign.kind === 'mandal'
            ? (async () => {
                  await syncMandalMembers(campaign);
                  const members = await mandalMembersOnce(campaign.id, Number(campaign.meta?.installment) || 0, today);
                  return members.reduce((sum, m) => sum + m.due, 0);
              })()
            : Promise.resolve(0);
    // "Add to group": groups this person may start a fundraise in (all, for fundraise managers) not linked yet.
    const addableP =
        perms.manage && campaign.kind !== 'mandal'
            ? (async () => {
                  const all = canManageAllFundraises(user.role);
                  const [groups, mine] = await Promise.all([listGroupsForSelect(), all ? [] : fundraiseGroupIds(user.id)]);
                  const linked = new Set([campaign.group_id, ...(campaign.groups ?? []).map((g) => g.id)]);
                  return groups
                      .filter((g) => !linked.has(g.id) && (all || mine.includes(g.id)))
                      .map((g) => ({
                          value: String(g.id),
                          label: localized(g, 'name', locale),
                      }));
              })()
            : Promise.resolve([]);
    // The Mandal total is needed by the tabs below (the Money summary): wait for it first — still alongside "Add to group".
    campaign.pending = Number(campaign.pending || 0) + (await mandalDueP);

    const groupName = localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale);
    const collected = Number(campaign.collected);
    const spent = Number(campaign.spent);
    const tabs = [
        {
            key: 'discussion',
            label: t('fundraise.tabs.discussion'),
            href: base,
            icon: MessageCircle,
        },
        {
            key: 'meetings',
            label: t('fundraise.tabs.meetings'),
            href: `${base}?tab=meetings`,
            icon: CalendarClock,
        },
        // A Mandal's money lives on its schedules: the tab is "Savings" (schedules + their sheets), not Income/Expense.
        campaign.kind === 'mandal'
            ? {
                  key: 'money',
                  label: t('mandal.savings'),
                  href: `${base}?tab=money`,
                  icon: PiggyBank,
              }
            : {
                  key: 'money',
                  label: t('fundraise.tabs.money'),
                  href: `${base}?tab=money`,
                  icon: Wallet,
              },
        {
            key: 'details',
            label: t('fundraise.tabs.details'),
            href: `${base}?tab=details`,
            icon: Info,
        },
    ];

    let body;
    if (tab === 'money') {
        // A Mandal's Savings tab IS this money tab: its overview leads with the schedules table, and one
        // schedule (?schedule=<id>) shows exactly the fundraise views, limited to that schedule's money.
        const isMandal = campaign.kind === 'mandal';
        const askedSid = isMandal ? Number(sp1(sp.schedule)) || null : null;
        const page = normalizePage(sp1(sp.page));
        const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value); // cookies are local — no DB
        const offset = (page - 1) * perPage;
        // One schedule adds 'absent': who did not come (nothing recorded counts as absent).
        const viewsFor = (s) => (isMandal ? (s ? [...MONEY_VIEWS, 'absent'] : ['schedules', ...MONEY_VIEWS]) : MONEY_VIEWS);
        // The rows for a schedule id — one schedule: all its rows (a single day — no paging needed).
        const loadRows = (s) => {
            const v = viewsFor(s).includes(rawView) ? rawView : viewsFor(s)[0];
            const paging = s ? { eventId: s } : { limit: perPage, offset };
            return Promise.all([
                v === 'contributions'
                    ? listContributions(campaign.id, paging)
                    : v === 'expenses'
                      ? listExpenses(campaign.id, paging)
                      : v === 'contributors'
                        ? contributorTotals(campaign.id, { publicView: !perms.manage, eventId: s })
                        : [],
                // One schedule: its own totals and counts for the boxes and the view switch.
                s ? Promise.all([listContributions(campaign.id, { eventId: s }), listExpenses(campaign.id, { eventId: s })]) : null,
            ]);
        };
        // Everything starts together: the Mandal parts, the rows for the schedule asked for (redone only if
        // that schedule turns out not to exist), the settings and the people.
        const [parts, guessed, settings, people] = await Promise.all([
            isMandal ? mandalMoneyParts({ campaign, user, today, t, locale, scheduleId: askedSid, base }) : null,
            loadRows(askedSid),
            getSettings('fundraise'),
            // "Paid by" (expenses) and "Kept by" (contributions) choices.
            perms.expense || perms.contribution ? fundraisePeople(campaign.id) : [],
        ]);
        const sid = parts?.chosen?.id ?? null;
        const views = viewsFor(sid);
        const mview = views.includes(rawView) ? rawView : views[0];
        const [rows, stats] = sid === askedSid ? guessed : await loadRows(sid);
        // Anonymous gifts: only managers see who gave (they get the name + an "Anonymous" badge).
        const shown = perms.manage || mview === 'expenses' ? rows : maskAnonymous(rows, t('fundraise.anonymousLabel'));
        const total = sid ? rows.length : mview === 'contributions' ? campaign.contribution_count : mview === 'expenses' ? campaign.expense_count : rows.length;
        const [inc, out] = stats ?? [[], []];
        // A Mandal's "+ Contribution" is the short form, for those who run its sheet, while a schedule is open.
        const mandalAdd = isMandal && parts.canRun && parts.mandalAdd.schedules.length ? parts.mandalAdd : null;
        const shownCampaign = sid
            ? {
                  ...campaign,
                  collected: inc.filter((r) => r.mode !== 'unpaid').reduce((a, r) => a + Number(r.amount), 0),
                  pending: inc.filter((r) => r.mode === 'unpaid').reduce((a, r) => a + Number(r.amount), 0),
                  spent: out.reduce((a, x) => a + Number(x.amount), 0),
                  target_amount: null,
              }
            : campaign;
        body = (
            <MoneyTab
                campaign={shownCampaign}
                views={views}
                counts={
                    sid
                        ? {
                              contributions: inc.length,
                              expenses: out.length,
                              absent: parts.absentCount,
                          }
                        : isMandal
                          ? {
                                schedules: parts.scheduleOptions.length,
                                contributions: campaign.contribution_count,
                                expenses: campaign.expense_count,
                            }
                          : null
                }
                scheduling={
                    isMandal
                        ? {
                              schedules: parts.scheduleOptions,
                              defaultSchedule: sid ?? parts.scheduleOptions[0]?.value ?? null,
                          }
                        : null
                }
                scheduleTable={parts?.scheduleTable ?? null}
                banner={parts?.banner ?? null}
                absentTable={parts?.absentTable ?? null}
                holdingPerRow={!isMandal}
                mandalAdd={mandalAdd}
                view={mview}
                rows={shown}
                total={total}
                page={page}
                perPage={perPage}
                perms={isMandal ? { ...perms, contribution: Boolean(mandalAdd) } : perms}
                settings={settings}
                today={today}
                base={base}
                sp={{
                    ...sp,
                    tab: 'money',
                    view: mview === views[0] ? undefined : mview,
                }}
                t={t}
                locale={locale}
                people={people}
                meId={user.id}
            />
        );
    } else if (tab === 'meetings') {
        // Minutes are updates tied to a meeting; they show under that meeting.
        // Handed over as promises: the meetings list loads its own data at the same time.
        const minutes = listUpdates(campaign.id).then((updates) =>
            updates
                .filter((u) => u.update_type === 'minutes' && u.event_id)
                .map((u) => ({ id: u.id, event_id: u.event_id, body: u.body, author: u.author, author_local: u.author_local })),
        );
        // A Mandal's meetings are its schedules: each card marks who came (those who run it), straight from here.
        const attendance = isMandal
            ? Promise.all([
                  mandalMeetingsOnce(campaign.id, Number(campaign.meta?.installment) || 0).then((m) => mandalAttendance(campaign.id, m)),
                  canRunMandal(user, campaign),
              ]).then(([byEvent, canMark]) => ({ byEvent, canMark }))
            : null;
        body = (
            <MeetingsSection
                scope="fundraise"
                scopeId={campaign.id}
                defaultTitle={`${campaign.title} — ${t('meetings.word')}`}
                defaultPlace={campaign.location ?? ''}
                minutes={minutes}
                canPostMinutes={perms.post}
                attendance={attendance}
            />
        );
    } else if (tab === 'details') {
        const [audience, team, holdings, updates, history, messageCount, editCount, mandalParts] = await Promise.all([
            getAudience(campaign.id),
            listTeam(campaign.id),
            // Holdings card (everyone who sees the fundraise or Mandal), under Team.
            listHoldings(campaign),
            listUpdates(campaign.id),
            listHistory(campaign.id, { limit: 50 }),
            countMessages('fundraise', campaign.id),
            historyCount(campaign.id),
            // A Mandal: its summary + Members and Schedules, placed into About's own two columns.
            campaign.kind === 'mandal' ? mandalAboutParts({ campaign, user, today, t, locale }) : null,
        ]);
        body = (
            <>
                {/* A Mandal: its members, schedules (with the money sheet) and who has the money, above the usual About. */}
                <DetailsTab
                    campaign={campaign}
                    audience={audience}
                    team={team}
                    holdings={holdings}
                    mandal={mandalParts}
                    updates={updates}
                    history={history}
                    perms={perms}
                    userId={user.id}
                    today={today}
                    t={t}
                    locale={locale}
                    messageCount={messageCount}
                    // Clear the discussion: app admins / sub-admins and the fundraise's own team admins only.
                    canClearChat={canClearChats(user.role) || perms.teamRoles.includes('admin')}
                    // Edit history: deleted only by app admins / sub-admins (canClearHistory).
                    historyCount={canClearHistory(user.role) ? editCount : 0}
                />
            </>
        );
    } else {
        // ChatPanel resolves who may read and post (team, group members) itself.
        body = <ChatPanel scope="fundraise" scopeId={campaign.id} />;
    }

    const addableGroups = await addableP;

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
                                href={`/fundraise/${campaign.id}/print`}
                                aria-label={t('common.downloadPdf')}
                                title={t('common.downloadPdf')}
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/20"
                            >
                                <FileDown className="size-4" />
                            </Link>
                            {perms.manage && (
                                <Link
                                    href={`/fundraise/${campaign.id}/edit`}
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
                                    {t('fundraise.yourRole')}: {perms.teamRoles.map((r) => t(`fundraise.teamRoles.${r}`)).join(', ')}
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
