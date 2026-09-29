import { ArrowLeft, CalendarClock, Info, MapPin, MessageCircle, Pencil, Wallet } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatPanel from '@/components/chat/chat-panel';
import WaTabs from '@/components/ui/wa-tabs';
import DetailsTab from '@/components/fundraise/details-tab';
import MoneyTab, { MONEY_VIEWS } from '@/components/fundraise/money-tab';
import Badge from '@/components/ui/badge';
import { fundraisePermissions } from '@/lib/access';
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

// Three tabs; the default (Discussion) is the absence of ?tab. Old tab values from
// notifications and bookmarks map onto the tab that now holds them.
const LEGACY = {
    contributions: ['money', 'contributions'],
    expenses: ['money', 'expenses'],
    contributors: ['money', 'contributors'],
    team: ['details'],
    meetings: ['details'],
    updates: ['details'],
};

function resolveTab(sp) {
    const raw = sp1(sp.tab);
    if (raw === 'money' || raw === 'details') return { tab: raw, view: sp1(sp.view) };
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
    // Drafts stay invisible to everyone who could not manage them (same rule as the list).
    if (campaign.status === 'draft' && !perms.manage) notFound();

    const { t, locale } = await getT();
    const { tab, view: rawView } = resolveTab(sp);
    const view = MONEY_VIEWS.includes(rawView) ? rawView : 'contributions';
    const base = `/fundraise/${campaign.id}`;
    const today = todayLocal();
    const upNext = await nextMeeting(campaign.id, today);

    const groupName = localized({ name: campaign.group_name, name_local: campaign.group_name_local }, 'name', locale);
    const collected = Number(campaign.collected);
    const spent = Number(campaign.spent);
    const tabs = [
        { key: 'discussion', label: t('fundraise.tabs.discussion'), href: base, icon: MessageCircle },
        { key: 'money', label: t('fundraise.tabs.money'), href: `${base}?tab=money`, icon: Wallet },
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
                  : contributorTotals(campaign.id),
            getSettings('fundraise'),
        ]);
        const total = view === 'contributions' ? campaign.contribution_count : view === 'expenses' ? campaign.expense_count : rows.length;
        body = (
            <MoneyTab
                campaign={campaign}
                view={view}
                rows={rows}
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
    } else if (tab === 'details') {
        const [audience, team, meetings, updates, history] = await Promise.all([
            getAudience(campaign.id),
            listTeam(campaign.id),
            listMeetings(campaign.id, today),
            listUpdates(campaign.id),
            listHistory(campaign.id, { limit: 50 }),
        ]);
        body = (
            <DetailsTab
                campaign={campaign}
                audience={audience}
                team={team}
                meetings={meetings}
                updates={updates}
                history={history}
                perms={perms}
                userId={user.id}
                today={today}
                printHref={`${base}/print`}
                t={t}
                locale={locale}
            />
        );
    } else {
        // ChatPanel resolves who may read and post (team, group members) itself.
        body = <ChatPanel scope="fundraise" scopeId={campaign.id} />;
    }

    return (
        <div className="theme-fundraise -mx-3 -mt-3 sm:-mx-5 sm:-mt-5">
            {/* Header strip: title, group, one-line totals; then three equal tabs. */}
            <div className="bg-brand-navy text-white">
                <div className="px-3 pt-3 sm:px-5">
                    <Link
                        href={`/groups/${campaign.group_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white"
                    >
                        <ArrowLeft className="size-3.5" /> {groupName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                        <h1 className="min-w-0 text-lg font-semibold break-words">{localized(campaign, 'title', locale)}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge status={campaign.status}>{t(`fundraise.${campaign.status}`)}</Badge>
                            {perms.teamRole && (
                                <Badge tone="orange">
                                    {t('fundraise.yourRole')}: {t(`fundraise.teamRoles.${perms.teamRole}`)}
                                </Badge>
                            )}
                            {perms.manage && (
                                <Link
                                    href={`${base}/edit`}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20"
                                >
                                    <Pencil className="size-3.5" /> {t('common.edit')}
                                </Link>
                            )}
                        </div>
                    </div>
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
                        {campaign.location && (
                            <span className="inline-flex items-center gap-0.5">
                                <MapPin className="size-3" /> {campaign.location}
                            </span>
                        )}
                    </p>
                    {upNext && (
                        <Link
                            href={`${base}?tab=details#meetings`}
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
            <div className="p-3 sm:p-5">{body}</div>
        </div>
    );
}
