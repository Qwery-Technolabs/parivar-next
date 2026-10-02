import { CalendarClock, CalendarDays, Globe, HandCoins, Info, Lock, MessageCircle, Pin, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatPanel from '@/components/chat/chat-panel';
import HeaderBack from '@/components/shell/header-back';
import MeetingsSection from '@/components/meetings/meetings-section';
import NextMeetingBanner from '@/components/meetings/next-meeting-banner';
import GroupAvatar from '@/components/groups/group-avatar';
import GroupFormDialog from '@/components/groups/group-form-dialog';
import GroupDangerCard from '@/components/groups/group-danger-card';
import { DOT_SIZE } from '@/lib/status-dot';
import GroupMembers from '@/components/groups/group-members';
import NewFundraiseMenu from '@/components/fundraise/new-fundraise-menu';
import { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import WaTabs from '@/components/ui/wa-tabs';
import { canCreateFundraiseIn, groupStanding } from '@/lib/access';
import { canAdminister, canEditDetails, canManageMembership, GROUP_STATUS_DOT } from '@/lib/group-roles';
import { requireUser } from '@/lib/auth';
import { messageCount } from '@/lib/chat';
import { todayLocal } from '@/lib/forms';
import { upcomingMeetingCount } from '@/lib/meetings';
import { date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getGroup, groupFundraises, groupMembers } from '@/lib/groups';
import { sp1 } from '@/lib/url';
import { canClearChats } from '@/lib/roles';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const g = await getGroup(Number(id) || 0);
    const { locale } = await getT();
    return { title: g ? localized(g, 'name', locale) : undefined };
}

const TABS = ['discussion', 'meetings', 'fundraise', 'members', 'about'];

/**
 * A group, laid out like old WhatsApp: a navy header with the group's name and three tabs —
 * Discussion (default = no ?tab), Fundraises, About.
 */
export default async function GroupPage({ params, searchParams }) {
    const { id } = await params;
    const sp = await searchParams;
    const user = await requireUser();
    const group = await getGroup(Number(id) || 0);
    if (!group) notFound();
    const { t, locale } = await getT();
    const tab = TABS.includes(sp1(sp.tab)) ? sp1(sp.tab) : 'discussion';

    const [members, fundraises, { standing, myRole }, canFundraise, messages, upcoming] = await Promise.all([
        groupMembers(group.id),
        groupFundraises(group.id, user),
        groupStanding(user, group.id),
        canCreateFundraiseIn(user, group.id),
        messageCount('group', group.id),
        upcomingMeetingCount(group.id, todayLocal()),
    ]);
    // A private group does not exist for outsiders.
    const isPrivate = group.meta.visibility === 'private';
    if (isPrivate && !standing && !myRole) notFound();
    // Archived: hidden from members — only app-level group managers and the group's admins open it.
    if (group.status === 'archived' && standing !== 'app' && standing !== 'admin') notFound();
    // Admins and sub-admins edit the group and manage its members (lib/group-roles.js).
    const canManage = canManageMembership(standing);
    const canEditGroup = canEditDetails(standing);
    const name = localized(group, 'name', locale);
    const base = `/groups/${group.id}`;

    return (
        <div>
            <HeaderBack href="/groups" label={t('groups.title')} />
            <div className="mb-3 overflow-hidden rounded-lg bg-brand-navy text-white shadow-sm">
                <div className="flex items-center gap-3 px-3 pt-3 sm:px-4">
                    {/* Status = a dot on the picture's bottom-right: green active, red inactive, grey archived. */}
                    <span className="relative shrink-0" title={t(`groups.status.${group.status}`)}>
                        <GroupAvatar
                            name={name}
                            kind={group.meta.avatar_kind}
                            value={group.meta.avatar_value}
                            color={group.meta.avatar_color}
                            tint="bg-white/15 text-white"
                            className="ring-2 ring-white/25"
                        />
                        <span
                            role="img"
                            aria-label={t(`groups.status.${group.status}`)}
                            className={`absolute right-0 bottom-0 ${DOT_SIZE} rounded-full ring-2 ring-brand-navy ${GROUP_STATUS_DOT[group.status] ?? GROUP_STATUS_DOT.active}`}
                        />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="flex items-center gap-1.5 text-base font-semibold">
                            <span className="truncate">{name}</span>
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-px text-[10px] font-medium text-white">
                                {isPrivate ? <Lock className="size-2.5" /> : <Globe className="size-2.5" />}
                                {t(isPrivate ? 'groups.visibility.private' : 'groups.visibility.public')}
                            </span>
                        </h1>
                        {/* white/70 on navy: 7.34:1 */}
                        <p className="truncate text-xs text-white/70">
                            {t('groups.memberCount', { count: members.length })}
                            {fundraises.length > 0 && ` · ${t('groups.fundraiseCount', { count: fundraises.length })}`}
                        </p>
                    </div>
                    {canEditGroup && <GroupFormDialog group={group} onNavy />}
                </div>
                <div className="mt-3">
                    <WaTabs
                        active={tab}
                        tabs={[
                            { key: 'discussion', label: t('groups.tabs.discussion'), href: base, count: messages, icon: MessageCircle },
                            { key: 'meetings', label: t('groups.tabs.meetings'), href: `${base}?tab=meetings`, count: upcoming, icon: CalendarClock },
                            { key: 'fundraise', label: t('groups.tabs.fundraise'), href: `${base}?tab=fundraise`, count: fundraises.length, icon: HandCoins },
                            { key: 'members', label: t('groups.tabs.members'), href: `${base}?tab=members`, count: members.length, icon: Users },
                            { key: 'about', label: t('groups.tabs.about'), href: `${base}?tab=about`, icon: Info },
                        ]}
                    />
                </div>
            </div>

            {tab === 'discussion' && (
                <>
                    <NextMeetingBanner scope="group" scopeId={group.id} href={`${base}?tab=meetings`} />
                    <ChatPanel scope="group" scopeId={group.id} />
                </>
            )}

            {tab === 'meetings' && <MeetingsSection scope="group" scopeId={group.id} defaultTitle={`${name} — ${t('meetings.word')}`} />}

            {tab === 'fundraise' && (
                <div className="theme-fundraise space-y-3">
                    {canFundraise && (
                        <div className="flex justify-end">
                            {/* Started from its group: a Fundraise, or a Mandal (savings circle) of this group. */}
                            <NewFundraiseMenu groupId={group.id} />
                        </div>
                    )}
                    {fundraises.length === 0 ? (
                        <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">
                            {t('fundraise.empty')}
                        </p>
                    ) : (
                        // Chat-list look: one row per fundraise, amount where the last-message time would be.
                        <ul className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                            {fundraises.map((f) => (
                                <li key={f.id}>
                                    <Link href={`/fundraise/${f.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/60">
                                        <GroupAvatar id={f.id} name={f.title} kind={f.avatar?.avatar_kind} value={f.avatar?.avatar_value} color={f.avatar?.avatar_color} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-1.5">
                                                {f.pinned ? <Pin className="size-3.5 shrink-0 rotate-45 text-brand-orange-strong" aria-label={t('mandal.pinned')} /> : null}
                                                <span className="truncate text-sm font-semibold text-primary">{localized(f, 'title', locale)}</span>
                                                {f.kind === 'mandal' && (
                                                    <Badge tone="orange" className="shrink-0">
                                                        {t('mandal.badge')}
                                                    </Badge>
                                                )}
                                            </span>
                                            <span className="flex items-center gap-1 truncate text-xs text-ink-gray">
                                                {f.start_date && <CalendarDays className="size-3 shrink-0" />}
                                                {f.start_date && date(f.start_date, locale)}
                                                {f.end_date && ` – ${date(f.end_date, locale)}`}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-right">
                                            <span className="block text-sm font-semibold tabular-nums text-income">{money(f.collected)}</span>
                                            <Badge status={f.status} className="mt-0.5">
                                                {t(`fundraise.${f.status}`)}
                                            </Badge>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {tab === 'members' && (
                <GroupMembers groupId={group.id} members={members} standing={standing} currentUserId={user.id} creatorId={group.created_by} />
            )}

            {tab === 'about' && (
                <div className="space-y-4">
                    <Card title={t('groups.about')}>
                        <p className="whitespace-pre-line text-sm text-ink">{group.meta.description || <span className="text-ink-gray">{t('groups.noDescription')}</span>}</p>
                        <p className="mt-3 text-xs text-ink-gray">{t('groups.createdOn', { date: date(String(group.created_at).slice(0, 10), locale) })}</p>
                    </Card>
                    {/* Danger zone: the group's admins (and app-level managers) change its status; an archived group can be deleted (app-level only). */}
                    {canAdminister(standing) && (
                        <GroupDangerCard
                            group={group}
                            canDelete={standing === 'app'}
                            // Clearing the discussion: app-level admins / sub-admins only (canClearChats).
                            canClearChat={canClearChats(user.role)}
                            messageCount={messages}
                            t={t}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
